# Console finish — 5 minutes (API key is missing a few scopes)

Site **warrant** and Function **warrant-control** are already created and
deployed via CLI. Your current API key cannot attach domains or web platforms
(`rules.*`, `platforms.*`). Do this in the Cloud console:

## 1. Expand the API key (optional, for future CLI)

Console → **Overview → API keys** → your key → enable also:

- `platforms.read` / `platforms.write`
- `rules.read` / `rules.write`
- `public` (helpful for list-frameworks)

## 2. Web platforms (required for the browser SDK)

Console → **Overview → Platforms** → **Add platform** → Web:

| Name | Hostname |
| --- | --- |
| Local | `localhost` |
| Loopback | `127.0.0.1` |
| Sites wildcard | `*.appwrite.network` |

## 3. Site domain (required for the live link)

Console → **Sites** → **warrant** → **Domains** → add:

`warrant-lab.appwrite.network`

(or any free `*.appwrite.network` label you like)

Copy the live URL into the README when it turns green.

## 4. Guest Realtime (if events don't show)

Console → **Auth → Settings / Policies** → ensure guests are **allowed** to
subscribe to Realtime (do **not** enable “deny realtime guests”).

## 5. Login CLI for future pushes (optional)

```bash
appwrite login
appwrite client -e https://fra.cloud.appwrite.io/v1 -p 6ae46e76000bcdbf394e
```

Then domains can be created with:

```bash
appwrite proxy create-site-rule --site-id warrant --domain warrant-lab.appwrite.network
```
