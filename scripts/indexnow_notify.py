"""Server-side IndexNow watcher. Fixed origin, durable GitHub journal, no customer data.
Uses only Python's standard library. Browser code never calls IndexNow.
"""
import argparse
import base64
import copy
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
import hashlib
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import re
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET

HOST = 'canakkalekonutrehberi.com'
ORIGIN = 'https://' + HOST
KEY = '9197921f586b4c9880cac1595f60d94a'
KEY_URL = ORIGIN + '/' + KEY + '.txt'
ENDPOINT = 'https://api.indexnow.org/indexnow'
REPOSITORY = 'mkutayozturk/ckr-web-sitesi'
STATE_PATH = 'automation/indexnow-state.json'
RETRIES = [300, 1800, 7200, 43200, 86400]
MAX_ATTEMPTS = len(RETRIES) + 1
URL_RE = re.compile(r'^https://canakkalekonutrehberi\.com/blog/(?!kategori/|sayfa/)[a-z0-9]+(?:-[a-z0-9]+)*/$')
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None
OPENER = urllib.request.build_opener(NoRedirect)

def now():
    return int(time.time())

def stamp():
    return datetime.now(timezone.utc).isoformat()

def valid_url(url):
    return isinstance(url, str) and bool(URL_RE.fullmatch(url))

def http(url, data=None, headers=None, method=None):
    # All destinations come from constants or strict validation, never an input URL.
    h = {'User-Agent': 'CKR-IndexNow/1.0', **(headers or {})}
    if data is not None:
        h['Content-Type'] = 'application/json; charset=utf-8'
        data = json.dumps(data).encode('utf-8')
    request = urllib.request.Request(url, data=data, headers=h, method=method)
    try:
        with OPENER.open(request, timeout=25) as response:
            body = response.read(2 * 1024 * 1024 + 1)
            if len(body) > 2 * 1024 * 1024:
                raise ValueError('Response exceeds size limit')
            return response.status, {k.lower(): v for k, v in response.headers.items()}, body
    except urllib.error.HTTPError as exc:
        return exc.code, {k.lower(): v for k, v in exc.headers.items()}, exc.read(2048)

class Head(HTMLParser):
    def __init__(self):
        super().__init__(); self.in_head = False; self.canonicals = []; self.blocked = False
    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        if tag == 'head': self.in_head = True
        if not self.in_head: return
        if tag == 'link' and attrs.get('rel', '').lower() == 'canonical':
            self.canonicals.append(attrs.get('href'))
        if tag == 'meta' and attrs.get('name', '').lower() in ['robots', 'googlebot', 'bingbot']:
            self.blocked |= bool(set(re.split(r'[,\s]+', attrs.get('content', '').lower())) & {'noindex', 'none'})
    def handle_endtag(self, tag):
        if tag == 'head': self.in_head = False

def read_inventory(fetch=http):
    code, _, raw = fetch(ORIGIN + '/indexnow-manifest.json')
    if code != 200: raise ValueError('Publication manifest unavailable: HTTP ' + str(code))
    data = json.loads(raw)
    if data.get('version') != 1 or data.get('host') != HOST or not isinstance(data.get('posts'), list):
        raise ValueError('Invalid publication manifest')
    inventory = {}
    for item in data['posts']:
        url, digest = item.get('url'), item.get('hash')
        if not valid_url(url) or not isinstance(digest, str) or not re.fullmatch('[a-f0-9]{64}', digest) or url in inventory:
            raise ValueError('Noncanonical, foreign or duplicate manifest URL')
        inventory[url] = digest
    code, _, raw = fetch(ORIGIN + '/sitemap.xml')
    if code != 200: raise ValueError('Sitemap unavailable: HTTP ' + str(code))
    urls = {node.text for node in ET.fromstring(raw).iter('{http://www.sitemaps.org/schemas/sitemap/0.9}loc') if valid_url(node.text)}
    if urls != set(inventory): raise ValueError('Manifest/sitemap mismatch; deployment may still be in progress')
    return inventory

def verify_key(fetch=http):
    code, headers, raw = fetch(KEY_URL)
    if code != 200 or headers.get('content-type', '').split(';')[0] != 'text/plain' or raw != KEY.encode():
        raise ValueError('Live IndexNow key verification failed')

def verify_event(event, inventory, fetch=http):
    url = event['url']
    if not valid_url(url): raise ValueError('Refused foreign/noncanonical URL')
    if event['kind'] == 'deleted':
        if url in inventory or not event.get('previous_hash'): raise ValueError('Deletion has no previous canonical publication')
        code, _, _ = fetch(url)
        if code not in (404, 410): raise ValueError('Removed URL must return 404/410, got ' + str(code))
    else:
        if inventory.get(url) != event['hash']: raise ValueError('URL is no longer the current publication')
        code, headers, raw = fetch(url)
        if code != 200 or 'text/html' not in headers.get('content-type', ''): raise ValueError('Public article unavailable: HTTP ' + str(code))
        head = Head(); head.feed(raw.decode('utf-8'))
        if head.canonicals != [url] or head.blocked or re.search(r'\b(noindex|none)\b', headers.get('x-robots-tag', ''), re.I):
            raise ValueError('Article must be public, indexable and self-canonical')

def empty_state():
    return {'version': 1, 'host': HOST, 'initialized': False, 'observed': {}, 'events': [], 'runs': []}

def queue_changes(state, inventory, test_url=None):
    if not state.get('initialized'):
        state['observed'] = {url: {'hash': digest, 'revision': 0} for url, digest in inventory.items()}
        state['initialized'] = True
        state['initialized_at'] = stamp()
    else:
        for url in sorted(set(inventory) | set(state['observed'])):
            old = state['observed'].get(url, {'hash': None, 'revision': 0})
            digest = inventory.get(url)
            if old['hash'] == digest: continue
            revision = old['revision'] + 1
            kind = 'deleted' if digest is None else 'new' if old['hash'] is None else 'updated'
            state['events'].append({'id': hashlib.sha256(f'{url}:{revision}:{digest}'.encode()).hexdigest(), 'url': url, 'hash': digest, 'previous_hash': old['hash'], 'revision': revision, 'kind': kind, 'status': 'pending', 'attempts': 0, 'due_at': now(), 'created_at': stamp()})
            state['observed'][url] = {'hash': digest, 'revision': revision}
    if test_url and not state.get('verification_test_queued'):
        if not valid_url(test_url) or test_url not in inventory: raise ValueError('Test URL is not a published canonical blog URL')
        item = state['observed'][test_url]
        state['events'].append({'id': 'verification-' + item['hash'], 'url': test_url, 'hash': item['hash'], 'revision': item['revision'], 'kind': 'verification_test', 'status': 'pending', 'attempts': 0, 'due_at': now(), 'created_at': stamp()})
        state['verification_test_queued'] = True

def retry_delay(attempts, retry_after=None):
    delay = RETRIES[min(max(attempts - 1, 0), len(RETRIES) - 1)]
    if retry_after:
        try: requested = int(retry_after)
        except ValueError:
            try: requested = int(parsedate_to_datetime(retry_after).timestamp() - now())
            except (ValueError, TypeError): requested = 0
        delay = max(delay, min(max(requested, 0), 86400))
    return delay

def process(state, inventory, save, fetch=http, max_events=20):
    completed = []
    for event in state['events']:
        if len(completed) >= max_events: break
        if event['status'] not in ['pending', 'retry', 'sending'] or event['due_at'] > now(): continue
        observed = state['observed'].get(event['url'], {})
        if observed.get('hash') != event['hash'] or observed.get('revision') != event['revision']:
            event['status'] = 'superseded'; save(state); continue
        # At least five minutes between any two attempts for the same URL.
        previous = max([e.get('last_attempt_epoch', 0) for e in state['events'] if e['url'] == event['url']] or [0])
        if previous + 300 > now(): continue
        if event['attempts'] >= MAX_ATTEMPTS:
            event['status'] = 'failed'; save(state); continue
        event['attempts'] += 1; event['last_attempt_at'] = stamp(); event['last_attempt_epoch'] = now()
        event['status'] = 'sending'; event['due_at'] = now() + retry_delay(event['attempts'])
        save(state)  # Write-ahead journal: no submission if persistence fails.
        code, headers = None, {}
        try:
            verify_event(event, inventory, fetch)
            code, headers, raw = fetch(ENDPOINT, {'host': HOST, 'key': KEY, 'keyLocation': KEY_URL, 'urlList': [event['url']]})
            event['http_status'] = code
            if code in (200, 202):
                event['status'] = 'submitted' if code == 200 else 'accepted_key_validation_pending'
                event['accepted_at'] = stamp(); event.pop('error', None)
            else:
                event['error'] = 'IndexNow HTTP ' + str(code) + ': ' + raw.decode('utf-8', errors='replace')[:300]
                event['status'] = 'retry' if (code == 429 or code >= 500) and event['attempts'] < MAX_ATTEMPTS else 'failed'
        except Exception as exc:
            event['error'] = type(exc).__name__ + ': ' + str(exc)[:300]
            event['status'] = 'retry' if event['attempts'] < MAX_ATTEMPTS else 'failed'
        event['due_at'] = now() + retry_delay(event['attempts'], headers.get('retry-after'))
        event.setdefault('attempt_log', []).append({'at': event['last_attempt_at'], 'http_status': code, 'status': event['status'], 'error': event.get('error')})
        save(state); completed.append({key: event.get(key) for key in ['url', 'kind', 'status', 'attempts', 'http_status', 'error']})
    return completed

class FileState:
    def __init__(self, path): self.path = Path(path)
    def load(self): return json.loads(self.path.read_text()) if self.path.exists() else empty_state()
    def save(self, state): self.path.parent.mkdir(parents=True, exist_ok=True); self.path.write_text(json.dumps(state, ensure_ascii=False, indent=2) + '\n')

class GitHubState:
    def __init__(self):
        if os.environ.get('GITHUB_REPOSITORY') != REPOSITORY: raise ValueError('Repository scope mismatch')
        token = os.environ.get('GITHUB_TOKEN')
        if not token: raise ValueError('Missing GitHub Actions token')
        self.headers = {'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28'}
        self.url = f'https://api.github.com/repos/{REPOSITORY}/contents/{STATE_PATH}'; self.sha = None
    def load(self):
        code, _, raw = http(self.url + '?ref=main', headers=self.headers)
        if code == 404: return empty_state()
        if code != 200: raise ValueError('Cannot read durable state: GitHub HTTP ' + str(code))
        data = json.loads(raw); self.sha = data['sha']; return json.loads(base64.b64decode(data['content']))
    def save(self, state):
        body = {'message': 'Record IndexNow publication notification state [skip render]', 'branch': 'main', 'content': base64.b64encode((json.dumps(state, ensure_ascii=False, indent=2) + '\n').encode()).decode()}
        if self.sha: body['sha'] = self.sha
        code, _, raw = http(self.url, body, self.headers, 'PUT')
        if code not in (200, 201): raise RuntimeError('Cannot persist notification state: GitHub HTTP ' + str(code))
        self.sha = json.loads(raw)['content']['sha']

def run(store, test_url=None):
    state = store.load()
    if state.get('version') != 1 or state.get('host') != HOST: raise ValueError('Durable state scope mismatch')
    before = copy.deepcopy(state)
    try:
        verify_key(); inventory = read_inventory(); queue_changes(state, inventory, test_url)
        if state != before: store.save(state)
        result = process(state, inventory, store.save)
        record = {'at': stamp(), 'status': 'ok', 'published': len(inventory), 'results': result}
    except Exception as exc:
        record = {'at': stamp(), 'status': 'failed', 'error': type(exc).__name__ + ': ' + str(exc)[:300]}
    # Unchanged checks stay in Actions logs; changed/failed runs also have durable history.
    if state != before or record['status'] == 'failed':
        state['runs'] = (state.get('runs', []) + [record])[-100:]; store.save(state)
    print(json.dumps(record, ensure_ascii=False), flush=True)
    Path('indexnow-run.json').write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n')
    return 1 if record['status'] == 'failed' or any(e['status'] == 'failed' for e in record.get('results', [])) else 0

if __name__ == '__main__':
    parser = argparse.ArgumentParser(); parser.add_argument('--state-file'); parser.add_argument('--test-url'); args = parser.parse_args()
    raise SystemExit(run(FileState(args.state_file) if args.state_file else GitHubState(), args.test_url))
