# AgentOps Desktop — Public Launch Checklist

> v0.1.0 launch preparation checklist. Check items as completed.

## Pre-launch: Code & Build

- [ ] All tests passing (unit + E2E)
- [ ] `npm run build` produces valid macOS DMG
- [ ] DMG tested on clean macOS install
- [ ] Auto-updater verified (install → update flow)
- [ ] Code signing configured and working
- [ ] Notarization completed for macOS DMG
- [ ] Version bumped to `0.1.0` in `package.json`
- [ ] Git tag `v0.1.0` created and pushed

## Pre-launch: Documentation

- [x] README.md updated to reflect actual feature set
- [x] CHANGELOG.md complete for v0.1.0
- [x] ROADMAP.md updated with accurate milestone status
- [x] RELEASE-NOTES.md written
- [x] ANNOUNCEMENT.md written (short + medium + long versions)
- [ ] CONTRIBUTING.md reviewed and current
- [ ] SECURITY.md reviewed and current
- [ ] LICENSE file present and correct
- [ ] docs-site/ content reviewed and accurate
- [ ] docs-site/ deployed to public URL

## Pre-launch: Repository

- [ ] `.gitignore` covers all build artifacts
- [ ] No secrets, tokens, or credentials in repo
- [ ] No large binary files in repo history
- [ ] Repository description and topics set on GitHub
- [ ] GitHub repository visibility set (public/private)
- [ ] Branch protection rules configured on `main`
- [ ] CI workflows passing on `main`

## Pre-launch: GitHub Release

- [ ] GitHub Release created for `v0.1.0`
- [ ] Release notes copied from RELEASE-NOTES.md
- [ ] macOS DMG attached to release
- [ ] Release marked as latest
- [ ] Release published (not draft)

## Pre-launch: Quality Gates

- [ ] Accessibility audit reviewed — WCAG AA compliance verified
- [ ] Security review completed — no critical/high findings outstanding
- [ ] UX audit reviewed — key issues addressed
- [ ] Performance acceptable on target hardware
- [ ] Error messages follow brand guidelines ([What] · [Why] · [What to do])

## Launch: Announcement

- [ ] GitHub Release published with announcement text
- [ ] Social media posts drafted (Twitter/X, LinkedIn, Reddit)
- [ ] Hacker News submission prepared
- [ ] Dev.to / Medium blog post prepared (long-form announcement)
- [ ] Relevant Discord/Slack communities identified for sharing

## Launch: Channels

- [ ] GitHub Discussions enabled (if desired)
- [ ] Issue templates configured (bug report, feature request)
- [ ] PR template configured
- [ ] Contributing guide linked from README

## Post-launch: Monitoring

- [ ] GitHub Issues monitored for first 48 hours
- [ ] CI/CD pipeline stable after public exposure
- [ ] Auto-updater tested with real users
- [ ] Feedback collected and triaged

## Post-launch: Follow-up

- [ ] First patch release planned (v0.1.1) if needed
- [ ] v0.2.0 roadmap refined based on feedback
- [ ] Community contributions reviewed and merged
- [ ] Documentation updated based on user questions

---

## Owner assignments

| Area | Owner | Status |
|------|-------|--------|
| Code & Build | Engineering | Pending |
| Documentation | CMO | ✅ In progress |
| Repository setup | DevOps | Pending |
| GitHub Release | Engineering + CMO | Pending |
| Quality gates | Engineering + Security | Pending |
| Announcement | CMO | ✅ In progress |
| Channel setup | CMO + DevOps | Pending |
| Post-launch monitoring | Engineering + CMO | Pending |

---

## Notes

- Documentation deliverables (README, CHANGELOG, ROADMAP, RELEASE-NOTES, ANNOUNCEMENT) are complete and ready for review.
- Code signing and notarization require Apple Developer credentials — verify these are configured in CI.
- docs-site deployment target needs to be decided (GitHub Pages, Vercel, Netlify, or custom domain).
- Social media accounts and community channels need to be set up before announcement.
