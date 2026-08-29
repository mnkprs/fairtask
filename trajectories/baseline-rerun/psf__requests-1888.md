# Trajectory — psf__requests-1888 — baseline (baseline-rerun)
Model: `claude-opus-5` · stratum: **unfair_tests** · human labels: underspecified=1, false_negative=2, filter_out=true

## Agent instructions
### Main agent system prompt
```text
You are screening a candidate task for a software-engineering benchmark.
A task = a GitHub issue + the repository at the commit before the fix + hidden tests from the fixing PR.
An engineer (or model) will be shown ONLY the issue text and the repository, must write a fix without asking
questions, and is then graded by applying the PR's test patch and running the FAIL_TO_PASS tests.

That setup is only fair if two assumptions hold. Score each on a 0-3 scale.

## Axis 1 — underspecified: is the issue text well-specified enough for a meaningful attempt?
Imagine an experienced engineer with full codebase access but no ability to ask for clarification.
- 0: The issue is well-specified and it is clear what is required for a successful solution.
- 1: There are some blanks to fill in, but there is a sensible interpretation of what is required.
- 2: The issue is vague and there is room for ambiguity. It is unclear what a successful solution would look like.
- 3: It is almost impossible to understand what you are being asked to do without further information.

## Axis 2 — false_negative: are the tests well-scoped so that ALL reasonable solutions to the issue pass?
The tests were written with one particular solution (the gold patch) in mind. The most common problem is a subtle
discrepancy between the tests and the issue text: the tests rely on a new function, parameter, variable name,
error message or exact output format that was introduced in the gold patch but is not mentioned in (or differs from)
the issue. Remember the engineer never sees the PR or the tests.
- 0: The tests perfectly cover all possible solutions.
- 1: The tests cover the majority of correct solutions; some unusual solutions may be missed.
- 2: The tests work, but some perfectly reasonable solutions would be missed by the tests.
- 3: The tests are too narrow/broad, or they look for something different than what the issue is about.

## Decision
"usable" if both scores are <= 1; otherwise "flag".

Answer with a JSON verdict matching the required schema.
```

### Task prompt
```text
# Candidate task: psf__requests-1888
Repository: psf/requests @ 19756d57f73c2062240dd477dd8f8d8a7c0c512a (version 2.2)

## Issue text (this is ALL the solver will see)
<issue>
301 redirect broken with latest pyopenssl/SNI
With the latest pyopenssl on Windows 64bit:

'''
cryptography==0.2.dev1
ndg-httpsclient==0.3.2
pyOpenSSL==0.13
pyasn1==0.1.7
'''

I get an exception raised when `GET`ing a `301` response to a HTTPS request. I see that after the redirect is received the returned URL is [decoded to a Unicode string](https://github.com/kennethreitz/requests/blob/master/requests/adapters.py#L181). Then requests passes the response to `resolve_redirects` which uses the url to make a new request. This leads to a Unicode string being passed to urllib3 and eventually pyopenssl. And because in pyopenssl they now check that the data is of type bytes, an exception is thrown. 

I Wrote this test:

'''
    def test_pyopenssl_redirect(self):
        requests.get('https://httpbin.org/status/301')
'''

and this is the result of py.test:

'''
_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _

self = <OpenSSL.SSL.Connection object at 0x000000000345CC50>
buf = u'GET /redirect/1 HTTP/1.1\r\nHost: httpbin.org\r\nAccept-Encoding: gzip, defl...cept: */*\r\nUser-Agent: python-r
equests/2.2.1 CPython/2.7.6 Windows/8\r\n\r\n'
flags = 0

    def sendall(self, buf, flags=0):
        """
            Send "all" data on the connection. This calls send() repeatedly until
            all data is sent. If an error occurs, it's impossible to tell how much
            data has been sent.

            :param buf: The string to send
            :param flags: (optional) Included for compatibility with the socket
                          API, the value is ignored
            :return: The number of bytes written
            """
        if isinstance(buf, _memoryview):
            buf = buf.tobytes()
        if not isinstance(buf, bytes):
>           raise TypeError("buf must be a byte string")
E           TypeError: buf must be a byte string

..\testreq\lib\site-packages\OpenSSL\SSL.py:968: TypeError
=================================== 117 tests deselected by '-kpyopenssl_redirect' ====================================
====================================== 1 failed, 117 deselected in 4.47 seconds =======================================
'''
</issue>

## Gold patch (the original PR's code change — the solver does NOT see this)
<gold_patch>
diff --git a/requests/sessions.py b/requests/sessions.py
--- a/requests/sessions.py
+++ b/requests/sessions.py
@@ -17,7 +17,7 @@
     cookiejar_from_dict, extract_cookies_to_jar, RequestsCookieJar, merge_cookies)
 from .models import Request, PreparedRequest
 from .hooks import default_hooks, dispatch_hook
-from .utils import to_key_val_list, default_headers
+from .utils import to_key_val_list, default_headers, to_native_string
 from .exceptions import TooManyRedirects, InvalidSchem
…[1754 more chars]
```

## Execution

- **session** `f35c72a6-8ed1-4db1-9027-441e949d62e7` · tools: StructuredOutput · subagents: claude, Explore, general-purpose, Plan, statusline-setup

#### judge/main → **final verdict**
```json
{
  "confidence": 4,
  "decision": "flag",
  "underspecified": 1,
  "underspecified_rationale": "The issue is quite precise: it names the exact mechanism (the redirect URL is decoded to a Unicode string in adapters.py, then reused by Session.resolve_redirects to build the next request, which explodes in pyOpenSSL's sendall because the buffer is not bytes/native str). An experienced engineer would reasonably converge on coercing the redirect URL back to a native string (e.g. via requests.utils.to_native_string) in resolve_redirects or prepare_url — which is exactly what the gold patch does in requests/sessions.py. The only blanks are where exactly to apply the coercion (adapters vs sessions vs models) and the fact that on Python 3 the change is effectively a no-op, so the intended behavioural difference is Python-2 specific and never stated.",
  "false_negative": 3,
  "false_negative_rationale": "The only test added by the test patch is `test_pyopenssl_redirect`, which merely does `requests.get('https://httpbin.org/status/301')` against the live network — yet that test is NOT in the FAIL_TO_PASS list. Instead FAIL_TO_PASS consists of seven unrelated live-network httpbin tests (test_user_agent_transfers, test_unicode_multipart_post, test_urlencoded_get_query_multivalued_param, test_params_are_merged_case_sensitive, test_HTTP_200_OK_GET_WITH_MIXED_PARAMS, test_cookie_persists_via_api, test_DIGEST_AUTH_SETS_SESSION_COOKIES), most of which (e.g. httpbin('get') with params, httpbin('user-agent'), httpbin('post')) never traverse Session.resolve_redirects and therefore cannot be affected by the one-line `to_native_string(url)` change the gold patch makes. The grading signal is thus decoupled from the issue: these tests appear to be network-flaky rather than fix-sensitive, so a perfectly correct fix can still fail (flaky httpbin.org / TLS access) and an empty patch could equally pass. The test that does target the issue exercises an external HTTPS endpoint and depends on pyOpenSSL/SNI being installed, which is itself environment-dependent rather than an assertion about the code change.",
  "evidence": [
    {
      "axis": "false_negative",
      "claim": "The only test introduced by the PR is a bare live-network HTTPS request with no assertions, and it is not among the FAIL_TO_PASS tests.",
      "quote": "+    def test_pyopenssl_redirect(self):\n+        requests.get('https://httpbin.org/status/301')",
      "ref": "test_requests.py",
      "source": "test_patch"
    },
    {
      "axis": "false_negative",
      "claim": "The gold patch only alters the URL assigned inside Session.resolve_redirects, so tests that perform no redirect (e.g. test_user_agent_transfers, test_urlencoded_get_query_multivalued_param) cannot be sensitive to it; yet those are the graded FAIL_TO_PASS tests.",
      "quote": "-            prepared_request.url = url\n+            prepared_request.url = to_native_string(url)",
      "ref": "requests/sessions.py",
      "source": "gold_patch"
    },
    {
      "axis": "underspecified",
      "claim": "The issue pinpoints the root cause and the code path, leaving only the choice of where to coerce the URL back to a native string.",
      "quote": "I see that after the redirect is received the returned URL is decoded to a Unicode string ... Then requests passes the response to `resolve_redirects` which uses the url to make a new request.",
      "ref": "issue",
      "source": "issue"
    }
  ]
}
```


## Result
- subtype: success · turns: 2 · 46s · cost $0.097 · tokens in/out/cache: 2/3688/4254

### ✅ Verification passed