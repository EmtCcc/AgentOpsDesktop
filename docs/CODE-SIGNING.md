# Code Signing & Notarization

This document covers setting up Apple code signing and notarization for AgentOps Desktop releases.

## Overview

macOS requires apps to be signed and notarized to pass Gatekeeper checks. Without signing, users see "App is damaged" or "unidentified developer" warnings.

The release workflow (`.github/workflows/release.yml`) handles signing and notarization automatically when the required GitHub Secrets are configured.

## Prerequisites

- Apple Developer account ($99/year)
- macOS machine for initial certificate creation
- GitHub admin access to configure repository secrets

## Step 1: Create Apple Developer Certificate

1. Open **Keychain Access** on macOS
2. Menu: Keychain Access → Certificate Assistant → Request a Certificate from a Certificate Authority
3. Enter your email, check "Saved to disk", click Continue
4. Save the `.certSigningRequest` file

5. Go to [Apple Developer → Certificates](https://developer.apple.com/account/resources/certificates/list)
6. Click "+" to create a new certificate
7. Select **Developer ID Application** (for distributing outside the App Store)
8. Upload the `.certSigningRequest` file
9. Download the `.cer` file and double-click to install in Keychain

## Step 2: Export Certificate as .p12

1. Open Keychain Access
2. Find the "Developer ID Application" certificate
3. Right-click → Export
4. Choose **Personal Information Exchange (.p12)**
5. Set a strong password (you'll need this for GitHub Secrets)
6. Save the `.p12` file

## Step 3: Create App-Specific Password

1. Go to [appleid.apple.com](https://appleid.apple.com)
2. Sign in with your Apple ID
3. Security → App-Specific Passwords → Generate
4. Label it "AgentOps Desktop CI"
5. Save the generated password

## Step 4: Configure GitHub Secrets

Go to your repository → Settings → Secrets and variables → Actions, and add:

| Secret | Value |
|--------|-------|
| `APPLE_CERTIFICATE` | Base64-encoded `.p12` file (see below) |
| `APPLE_CERTIFICATE_PASSWORD` | Password you set when exporting the `.p12` |
| `APPLE_ID` | Your Apple ID email |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password from Step 3 |
| `APPLE_TEAM_ID` | Your Apple Developer Team ID (find at [developer.apple.com/account](https://developer.apple.com/account) under Membership) |

### Encoding the Certificate

```bash
base64 -i certificate.p12 | pbcopy
# Paste the clipboard contents into APPLE_CERTIFICATE
```

## Step 5: Verify

Create a test release to verify signing works:

```bash
git tag v0.1.0-test
git push origin v0.1.0-test
```

Check the Actions tab for the release workflow. The build log will show:
- Certificate import success
- Code signing status
- Notarization submission and result

## Troubleshooting

### "No identity found" error

The certificate isn't properly imported into the keychain. Verify:
- The `.p12` file is valid
- The base64 encoding is correct (no line breaks)
- The password matches

### Notarization fails

- Verify `APPLE_ID` and `APPLE_APP_SPECIFIC_PASSWORD` are correct
- Check that `APPLE_TEAM_ID` matches your Developer account
- Ensure the app has `hardenedRuntime: true` (already configured)

### Users still see Gatekeeper warnings

- Verify notarization completed (check Apple's notarization log)
- Ensure `entitlements.mac.plist` is included in the build
- Try stapling: `xcrun stapler staple "AgentOps.app"`

## References

- [Apple Code Signing Guide](https://developer.apple.com/support/code-signing/)
- [electron-builder Code Signing](https://www.electron.build/code-signing)
- [Apple Notarization](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
