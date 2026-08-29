# Digital Asset Links

`assetlinks.json` is what makes the Android app a *Trusted* Web Activity. If
Android cannot fetch it from `https://<your-domain>/.well-known/assetlinks.json`
and match the fingerprint against the app that is asking, the app still runs —
but Chrome draws its address bar across the top of every screen, and it stops
looking like an app.

Next serves `public/` verbatim, so this path works with no route handler and no
rewrite. Vercel needs no config either.

## Two values must be filled before this is worth anything

1. **`package_name`** — whatever you set as the application id when you run
   `bubblewrap init`. The value here is a guess based on the current domain;
   change it if you choose something else, and keep it identical in both places.

2. **`sha256_cert_fingerprints`** — the SHA-256 of the certificate that signs
   the app **as users receive it**.

## The trap

Take the fingerprint from **Play Console → Test and release → Setup → App
signing**, under *App signing key certificate*.

Do **not** use the fingerprint of your local upload keystore, and do not use the
one `bubblewrap` prints after a local build. Google re-signs every upload with
its own key, so the certificate on the device is not the one you built with. A
fingerprint mismatch here is the single most common reason a TWA ships with a
browser address bar visible.

This means the order is: create the app in Play Console → upload the AAB once →
read the fingerprint → fill it in here → deploy → then test.

You can list more than one fingerprint. Adding the upload key alongside the Play
signing key is useful while testing locally built APKs.

## Checking it

    curl https://<your-domain>/.well-known/assetlinks.json

Then, with the app installed on a device:

    adb shell am start -a android.intent.action.VIEW -d "https://<your-domain>/home"

If it opens fullscreen with no address bar, verification passed.
