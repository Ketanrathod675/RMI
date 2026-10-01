# Backend Issue & Recommendation: Customer Care API Returning Nulls

## 1. Issue Summary
When the mobile app requests `GET /api/v1/general-info/customer-care`, the endpoint responds with `200 OK`, but all contact fields are `null`:
```json
{
  "success": true,
  "message": "Customer care data retrieved successfully",
  "data": {
    "email": null,
    "phone": null,
    "whatsapp": null
  }
}
```

However, when querying `GET /api/v1/general-info?type=customer_care`, the records **do exist** in the database:
```json
{
  "items": [
    { "type": "customer_care", "slug": "whatsapp", "value": "9876567876" },
    { "type": "customer_care", "slug": "phone", "value": "9876543201" },
    { "type": "customer_care", "slug": "email", "value": "ytrewq@sfdvb.dsfc" }
  ]
}
```

---

## 2. Root Cause in Backend Code
In `app/api/v1/general_info.py`:
```python
@public_router.get(
    "/customer-care",
    response_model=StandardResponse[Dict[str, Any]],
)
def get_customer_care(
    db: Session = Depends(get_db),
):
    rows = (
        db.query(GeneralInfo)
        .filter(
            GeneralInfo.type == "customer_care",
            GeneralInfo.slug.in_(
                [
                    "customer-care-email",
                    "customer-care-phone",
                    "customer-care-whatsapp",
                ]
            ),
        )
        .all()
    )
```

The database entries saved from admin/seeds use slugs:
- `"whatsapp"` (instead of `"customer-care-whatsapp"`)
- `"phone"` (instead of `"customer-care-phone"`)
- `"email"` (instead of `"customer-care-email"`)

Because of this mismatch, `rows` evaluates to an empty list `[]`, causing the endpoint to return `{"email": null, "phone": null, "whatsapp": null}`.

---

## 3. Recommended Fix for Backend
Support both prefixed and non-prefixed slug variants in `app/api/v1/general_info.py`:

```python
@public_router.get(
    "/customer-care",
    response_model=StandardResponse[Dict[str, Any]],
)
def get_customer_care(
    db: Session = Depends(get_db),
):
    rows = (
        db.query(GeneralInfo)
        .filter(
            GeneralInfo.type == "customer_care",
            GeneralInfo.slug.in_(
                [
                    "customer-care-email",
                    "customer-care-phone",
                    "customer-care-whatsapp",
                    "email",
                    "phone",
                    "whatsapp",
                ]
            ),
        )
        .all()
    )

    customer_care = {
        "email": None,
        "phone": None,
        "whatsapp": None,
    }

    slug_mapping = {
        "customer-care-email": "email",
        "customer-care-phone": "phone",
        "customer-care-whatsapp": "whatsapp",
        "email": "email",
        "phone": "phone",
        "whatsapp": "whatsapp",
    }

    for row in rows:
        field = slug_mapping.get(row.slug)
        if field and row.value and row.value.strip():
            customer_care[field] = row.value.strip()

    return StandardResponse[Dict[str, Any]](
        success=True,
        message="Customer care data retrieved successfully",
        data=customer_care,
    )
```

---

## 4. Mobile App Status
The mobile app has already been made resilient to this issue:
- If `/general-info/customer-care` returns `null`s, the frontend automatically falls back to fetch `/general-info?type=customer_care` and resolves the contact numbers and email address seamlessly.
