"""Exercise the actual inline cloud-monitor predicate without network access."""
import ast
import textwrap
import unittest
from datetime import datetime
from pathlib import Path

workflow = Path(__file__).resolve().parents[1] / '.github/workflows/market-index.yml'
script = textwrap.dedent(workflow.read_text().split("python -u - <<'PY'\n",1)[1]).rsplit('\nPY',1)[0]
parsed = ast.parse(script)
namespace = {}
for node in parsed.body:
    if isinstance(node, (ast.Import, ast.ImportFrom, ast.FunctionDef)):
        exec(compile(ast.Module(body=[node], type_ignores=[]), str(workflow), 'exec'), namespace)
check = namespace['successful_today']

class DailyMonitor(unittest.TestCase):
    def setUp(self):
        self.now = datetime.fromisoformat('2026-10-18T08:30:00+00:00')
        self.job = dict(status='ok',last_attempt_at='2026-10-18T08:20:00+00:00',running_until='2026-10-18T08:20:00+00:00',last_successful_check_at='2026-10-18T08:21:00+00:00')
    def test_completed_today_is_accepted(self):
        self.assertTrue(check(self.job,self.now))
    def test_yesterdays_success_is_rejected_even_within_twenty_four_hours(self):
        old={**self.job,'last_attempt_at':'2026-10-17T12:00:00+00:00','running_until':'2026-10-17T12:00:00+00:00','last_successful_check_at':'2026-10-17T12:01:00+00:00'}
        self.assertFalse(check(old,self.now))
    def test_stale_success_cannot_mask_new_running_or_failed_attempt(self):
        self.assertFalse(check({**self.job,'last_attempt_at':'2026-10-18T08:29:00+00:00'},self.now))
        self.assertFalse(check({**self.job,'running_until':'2026-10-18T08:39:00+00:00'},self.now))
        self.assertFalse(check({**self.job,'status':'error'},self.now))
    def test_missing_malformed_naive_and_future_dates_are_rejected(self):
        self.assertFalse(check({},self.now))
        for stamp in ['invalid','2026-10-18T08:21:00','2026-10-18T09:00:00+00:00']:
            self.assertFalse(check({**self.job,'last_successful_check_at':stamp},self.now))
    def test_date_is_turkey_date_across_utc_midnight(self):
        job={**self.job,'last_attempt_at':'2026-10-17T21:10:00+00:00','running_until':'2026-10-17T21:10:00+00:00','last_successful_check_at':'2026-10-17T21:11:00+00:00'}
        self.assertTrue(check(job,datetime.fromisoformat('2026-10-18T00:10:00+00:00')))
        job['last_successful_check_at']='2026-10-17T20:59:00+00:00'
        self.assertFalse(check(job,datetime.fromisoformat('2026-10-17T21:10:00+00:00')))

if __name__=='__main__':unittest.main()
