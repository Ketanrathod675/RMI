# Backend Fix: Easebuzz `verify-status/{txnid}` 500 Error & Mobile App Redirect

## 1. Issue: 500 Internal Server Error on `POST /api/v1/payment/verify-status/{txnid}`

### Stack Trace / Cause
When the mobile app polls `POST /api/v1/payment/verify-status/{txnid}`, FastAPI crashes with:
```text
AttributeError: 'Settings' object has no attribute 'EASEBUZZ_DASHBOARD_URL'
```

In `app/api/v1/payments.py` line 171:
```python
def _query_easebuzz_status_api(txnid: str) -> Dict[str, Any] | None:
    ...
    url = f"{settings.EASEBUZZ_DASHBOARD_URL}/transaction/v1/retrieve"  # <-- CRASHES HERE (AttributeError)
    try:
        resp = requests.post(url, data=eb_payload, timeout=10)
        ...
```
Because line 171 is outside the `try...except requests.RequestException` block, and `EASEBUZZ_DASHBOARD_URL` is not defined in `app/core/config.py`, this unhandled exception crashes the endpoint with **500 Internal Server Error**.

---

### Backend Fix 1: Add `EASEBUZZ_DASHBOARD_URL` to `app/core/config.py`
In `app/core/config.py` under the `# Easebuzz Configuration` section, add:
```python
    EASEBUZZ_DASHBOARD_URL: str = Field(
        default="https://testdashboard.easebuzz.in",
        env="EASEBUZZ_DASHBOARD_URL",
    )
```
*(In production, set `EASEBUZZ_DASHBOARD_URL=https://dashboard.easebuzz.in` in `.env`)*

---

### Backend Fix 2: Defensive check in `app/api/v1/payments.py`
In `app/api/v1/payments.py`, update `_query_easebuzz_status_api`:
```python
def _query_easebuzz_status_api(txnid: str) -> Dict[str, Any] | None:
    """Queries Easebuzz Transaction Status API directly."""
    hash_seq = f"{settings.EASEBUZZ_KEY}|{txnid}|{settings.EASEBUZZ_SALT}"
    api_hash = hashlib.sha512(hash_seq.encode("utf-8")).hexdigest()

    eb_payload = {
        "key": settings.EASEBUZZ_KEY,
        "txnid": txnid,
        "hash": api_hash,
    }
    dashboard_url = getattr(
        settings, "EASEBUZZ_DASHBOARD_URL", "https://testdashboard.easebuzz.in"
    )
    url = f"{dashboard_url}/transaction/v1/retrieve"
    try:
        resp = requests.post(url, data=eb_payload, timeout=10)
        res_data = resp.json()
        if res_data.get("status"):
            return res_data.get("msg")
        return None
    except Exception as exc:
        logger.error(f"Easebuzz status query failed: {exc}")
        return None
```

---

## 2. Issue: Seamless Mobile App Redirection After Payment

### Cause
In `app/api/v1/payments.py`, line 154:
```python
def _redirect_to_payment_status(txnid: str) -> RedirectResponse:
    parsed_url = urlsplit(settings.FRONTEND_PAYMENT_STATUS_URL)
    ...
```
`FRONTEND_PAYMENT_STATUS_URL` is set to `http://localhost:3000/borrower/payment-status`. On mobile phones, `localhost:3000` is inaccessible.

### Recommended Backend Solution
Support the mobile deep link scheme `rapid-money://`:
If the payment originated from the mobile app (or if `txnid` starts with `AF_`):
Redirect to:
```python
rapid-money://assessment-fee?status=success&txnid={txnid}
```
This allows the in-app browser (`WebBrowser.openAuthSessionAsync`) on Android and iOS to automatically intercept the URL, close the payment tab, and return the user smoothly into the app!
