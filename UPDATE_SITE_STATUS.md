# Site Status Banner

The site status banner is now automatically managed through the database. You can update it without redeploying the app.

## How to Update the Site Status

Run these SQL commands in your Supabase SQL Editor:

### Enable the banner
```sql
UPDATE site_status
SET enabled = true
WHERE id = 1;
```

### Disable the banner
```sql
UPDATE site_status
SET enabled = false
WHERE id = 1;
```

### Change the message
```sql
UPDATE site_status
SET message = 'Your custom message here'
WHERE id = 1;
```

### Change the banner type
```sql
-- Options: 'warning' (orange), 'info' (blue), 'error' (red)
UPDATE site_status
SET type = 'warning'
WHERE id = 1;
```

### Update everything at once
```sql
UPDATE site_status
SET
  enabled = true,
  message = 'Scheduled maintenance from 2-4pm EST',
  type = 'info'
WHERE id = 1;
```

## View Current Status
```sql
SELECT * FROM site_status;
```

## Examples

### Maintenance notification
```sql
UPDATE site_status
SET
  enabled = true,
  message = 'We are performing scheduled maintenance. Service will be restored shortly.',
  type = 'warning'
WHERE id = 1;
```

### General announcement
```sql
UPDATE site_status
SET
  enabled = true,
  message = 'New features coming soon! Stay tuned.',
  type = 'info'
WHERE id = 1;
```

### Critical issue
```sql
UPDATE site_status
SET
  enabled = true,
  message = 'We are experiencing technical difficulties. Our team is working on a fix.',
  type = 'error'
WHERE id = 1;
```

### Turn off the banner when resolved
```sql
UPDATE site_status
SET enabled = false
WHERE id = 1;
```
