import copy
import importlib.util
import json
from pathlib import Path
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('indexnow', Path(__file__).resolve().parents[1] / 'indexnow_notify.py')
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
URL = m.ORIGIN + '/blog/ornek-yazi/'
A, B = 'a' * 64, 'b' * 64

class WatcherTests(unittest.TestCase):
    def baseline(self):
        state = m.empty_state(); m.queue_changes(state, {URL: A}); return state
    def event(self, kind='updated'):
        state = self.baseline()
        m.queue_changes(state, {} if kind == 'deleted' else {URL: B})
        return state
    def fetch(self, code=200):
        calls = []
        def fake(url, data=None, **kwargs):
            calls.append((url, data))
            if url == m.ENDPOINT: return code, {}, b'provider response'
            return 200, {'content-type': 'text/html'}, ('<html><head><link rel="canonical" href="'+URL+'"></head></html>').encode()
        return fake, calls
    def test_only_canonical_domain_blog_urls(self):
        self.assertTrue(m.valid_url(URL))
        for bad in [URL+'?x=1', URL[:-1], URL.replace('https:', 'http:'), URL.replace(m.HOST, 'evil.com'), m.ORIGIN+'/admin/', m.ORIGIN+'/blog/kategori/alici/']:
            self.assertFalse(m.valid_url(bad), bad)
    def test_baseline_does_not_resubmit_unchanged_posts(self):
        state = self.baseline(); m.queue_changes(state, {URL:A}); self.assertEqual(state['events'], [])
    def test_new_updated_deleted_and_restored(self):
        state = self.baseline(); other=m.ORIGIN+'/blog/ikinci/'
        m.queue_changes(state, {URL:B, other:A}); m.queue_changes(state, {other:A}); m.queue_changes(state, {URL:B, other:A})
        self.assertEqual([x['kind'] for x in state['events']], ['new','updated','deleted','new'])
        self.assertEqual(state['observed'][URL]['revision'], 3)
    def test_test_notification_only_once(self):
        state=self.baseline(); m.queue_changes(state,{URL:A},URL);m.queue_changes(state,{URL:A},URL)
        self.assertEqual(len(state['events']),1)
    def test_200_is_persisted_before_and_after_submission(self):
        state=self.event(); fetch,calls=self.fetch(); saved=[]
        result=m.process(state,{URL:B},lambda s:saved.append(copy.deepcopy(s)),fetch)
        self.assertEqual(saved[0]['events'][0]['status'],'sending')
        self.assertEqual(result[0]['status'],'submitted')
        self.assertEqual(saved[-1]['events'][0]['http_status'],200)
        self.assertEqual(calls[-1][1]['urlList'],[URL])
    def test_202_is_not_reported_as_indexing_confirmation(self):
        state=self.event();fetch,_=self.fetch(202)
        self.assertEqual(m.process(state,{URL:B},lambda s:None,fetch)[0]['status'],'accepted_key_validation_pending')
    def test_no_repeat_after_success(self):
        state=self.event();fetch,calls=self.fetch();m.process(state,{URL:B},lambda s:None,fetch);m.process(state,{URL:B},lambda s:None,fetch)
        self.assertEqual(sum(u==m.ENDPOINT for u,d in calls),1)
    def test_transient_errors_retry_later(self):
        for code in [429,500,503]:
            state=self.event();fetch,calls=self.fetch(code);result=m.process(state,{URL:B},lambda s:None,fetch)
            self.assertEqual(result[0]['status'],'retry');self.assertGreater(state['events'][0]['due_at'],m.now())
            self.assertEqual(m.process(state,{URL:B},lambda s:None,fetch),[])
    def test_permanent_errors_do_not_loop(self):
        for code in [400,403,422]:
            state=self.event();fetch,_=self.fetch(code)
            self.assertEqual(m.process(state,{URL:B},lambda s:None,fetch)[0]['status'],'failed')
    def test_retry_is_bounded(self):
        state=self.event();state['events'][0]['attempts']=5;fetch,_=self.fetch(503)
        self.assertEqual(m.process(state,{URL:B},lambda s:None,fetch)[0]['status'],'failed')
    def test_persistence_failure_prevents_api_submission(self):
        state=self.event();fetch,calls=self.fetch()
        def fail(s): raise RuntimeError('storage unavailable')
        with self.assertRaises(RuntimeError):m.process(state,{URL:B},fail,fetch)
        self.assertEqual(calls,[])
    def test_outdated_event_superseded(self):
        state=self.event();m.queue_changes(state,{URL:A});fetch,calls=self.fetch()
        m.process(state,{URL:A},lambda s:None,fetch)
        self.assertEqual(state['events'][0]['status'],'superseded')
        self.assertEqual(sum(u==m.ENDPOINT for u,d in calls),1)
    def test_delete_requires_actual_404_or_410(self):
        state=self.event('deleted');event=state['events'][0]
        for code in [404,410]:m.verify_event(event,{},lambda u:(code,{},b''))
        for code in [200,301,500]:
            with self.assertRaises(ValueError):m.verify_event(event,{},lambda u:(code,{},b''))
    def test_noindex_wrong_canonical_and_redirect_refused(self):
        event=self.event()['events'][0]
        for code,head in [(200,'<meta name="robots" content="noindex"><link rel="canonical" href="'+URL+'">'),(200,'<link rel="canonical" href="https://evil.com/">'),(301,'')]:
            with self.assertRaises(ValueError):m.verify_event(event,{URL:B},lambda u:(code,{'content-type':'text/html'},('<head>'+head+'</head>').encode()))
    def test_partial_manifest_cannot_create_false_deletions(self):
        manifest={'version':1,'host':m.HOST,'posts':[]}
        sitemap='<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>'+URL+'</loc></url></urlset>'
        def fake(u):return 200,{},json.dumps(manifest).encode() if u.endswith('.json') else sitemap.encode()
        with self.assertRaises(ValueError):m.read_inventory(fake)
    def test_foreign_manifest_url_rejected(self):
        data={'version':1,'host':m.HOST,'posts':[{'url':'https://evil.com/blog/x/','hash':A}]}
        with self.assertRaises(ValueError):m.read_inventory(lambda u:(200,{},json.dumps(data).encode()))
    def test_retry_after_respected_and_capped(self):
        self.assertEqual(m.retry_delay(1,'600'),600);self.assertEqual(m.retry_delay(1,'999999'),86400)
    def test_key_file_must_be_plain_exact_text(self):
        m.verify_key(lambda u:(200,{'content-type':'text/plain; charset=utf-8'},m.KEY.encode()))
        with self.assertRaises(ValueError):m.verify_key(lambda u:(200,{'content-type':'text/html'},m.KEY.encode()))

if __name__=='__main__':unittest.main()
