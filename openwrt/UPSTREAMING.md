# Upstreaming this feed

Punch list for turning this self-hosted feed into PRs against the real
`openwrt/packages` and `openwrt/luci` repos.

## Must fix before opening a PR

1. **`PKG_SOURCE_URL` points at a personal fork.** `net/innernet/Makefile`
   currently pins `https://github.com/jebotz/innernet.git`. It needs to
   point at the real upstream (`tonarino/innernet`), pinned to a tagged
   release or at least a real upstream commit — not a fork.
2. **`PKG_MIRROR_HASH:=skip`.** That's a self-hosted-feed shortcut; upstream
   requires a real hash of the pinned source so the mirror/integrity system
   works.
3. **Split into two PRs against two different repos.** `net/innernet` goes
   to `openwrt/packages`; `luci-proto-innernet` goes to `openwrt/luci`
   (under `protocols/`). They can't land together.
4. **Sign-off / DCO.** OpenWrt requires `git commit -s` (Developer
   Certificate of Origin) on contributions; the commits so far aren't
   signed off.

## Likely review pushback (not hard blockers, but expect questions)

5. **Client-only, no server package.** Most OpenWrt Rust/Go VPN packages
   ship client+server as sibling `Package/` stanzas from one Makefile (see
   `nebula`/`nebula-cert`/`nebula-service` as the pattern). Reviewers may
   ask why the server's omitted rather than just unbuilt-by-default.
6. **Only tested on `ramips/mt7621`.** You'll likely be asked to at least
   confirm it builds (not necessarily runs) on a couple of other arches
   before merge, since `RUST_ARCH_DEPENDS` claims broader `mipsel`/general
   support.
7. **No `uci-defaults` script.** Nice-to-have for polish (auto-scaffolding
   a `network` section after `innernet install`), not required.

## Mechanical / CI

8. Both feeds run CI (build + lint) on PRs — worth a local
   `./scripts/checkpatch` or equivalent pass first. The Rust host-toolchain
   build (rustc + LLVM from source) is heavy; not disqualifying since other
   Rust packages already do this, but expect a slow CI run.
9. Maintainer contact (`PKG_MAINTAINER`) needs to stay reachable
   long-term — that's already `Juergen Botz <jurgen@botz.org>`, so nothing
   to change there.
