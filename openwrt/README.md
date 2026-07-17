# innernet OpenWrt feed

Self-hosted OpenWrt package feed for the innernet client, currently scoped
to a single target: `ramips/mt7621` (this covers the MikroTik RB750Gr3).
Only the client (`innernet`) is packaged — no server.

Two packages:
- `net/innernet` — the client binary, procd init script, UCI config, and a
  `netifd` protocol handler so a network brought up by the daemon can be
  recognized as a logical interface.
- `luci-proto-innernet` — LuCI-side frontend for that protocol handler
  (without it, LuCI shows "Unsupported protocol" for `innernet` interfaces
  even though `netifd`/the CLI handle them fine).

Layout mirrors the real `openwrt/packages` feed (`<category>/<pkgname>/`)
on purpose, so moving `net/innernet` into a PR against that feed later is
close to a copy-paste. `luci-proto-innernet` would move into the `luci`
feed's `protocols/` directory instead.

## One-time OpenWrt build setup

You need an OpenWrt buildroot checkout (not just the SDK, since building
Rust packages pulls in `rust/host` as a build dependency):

```
git clone https://git.openwrt.org/openwrt/openwrt.git
cd openwrt
./scripts/feeds update -a
./scripts/feeds install -a -p packages   # brings in lang/rust
./scripts/feeds install -a -p luci       # brings in luci-base, for luci-proto-innernet
```

Add this feed by pointing at your local checkout of *this* repo's
`openwrt/` directory (edit `feeds.conf.default`, or pass `-f` to
`feeds.conf`):

```
src-link innernet /path/to/innernet/openwrt
```

then:

```
./scripts/feeds update innernet
./scripts/feeds install -a -p innernet
```

`src-link` just symlinks, so local edits to the Makefile/init script show
up immediately without re-running `feeds update`.

## Configure

```
make menuconfig
```

- Target System: `MediaTek Ralink ARM/MIPS` → Subtarget `MT7621 based boards`
  → Target Profile: `MikroTik RB750Gr3`
- Network → VPN → `innernet` (built-in, i.e. `<*>`, not `<M>`, keeps this
  simple for a single-purpose image; switch to module if you'd rather
  install the .apk after the fact instead of baking it into the firmware).
- LuCI → 6. Protocols → `luci-proto-innernet`, if you want the `innernet`
  network recognized under LuCI's Network → Interfaces page instead of
  showing up as "Unsupported protocol". Only needed on boxes running LuCI;
  the CLI (`innernet show`, `ip link`, etc.) and firewall/netifd don't need
  it.

Building it pulls in the Rust host toolchain (`rust/host`) automatically
via `PKG_BUILD_DEPENDS`; the first build will take a while.

## Build

```
make package/innernet/compile V=s
make package/luci-proto-innernet/compile V=s
```

The resulting `.apk`s land under `bin/packages/mipsel_24kc/innernet/`.
Install them on the router with `apk add` (or bake them into a full image
via `make` at the top level once they're selected in menuconfig).

## Iterating on source changes

`PKG_SOURCE_PROTO:=git` pins an exact commit (`PKG_SOURCE_VERSION` in
`net/innernet/Makefile`). After pushing new commits to the repo the feed
points at:

```
# bump PKG_SOURCE_VERSION (and PKG_RELEASE) in net/innernet/Makefile, then:
make package/innernet/{clean,download,prepare,compile} V=s
```

## UCI configuration

`/etc/config/innernet` (installed as a conffile, so upgrades won't clobber
your edits) has one `global` section for defaults and one `network`
section per innernet network you've joined (via `innernet install
<invite-file>` — that step isn't UCI-driven, it's a one-time interactive
command you still run by hand over SSH). See the comments in
`net/innernet/files/innernet.config` for all options. Minimal example for
a single network named `home`:

```
config global 'global'
	option interval '60'
	option write_hosts '1'
	option hosts_path '/tmp/hosts/innernet'
	option nat_traversal '1'
	option config_dir '/etc/innernet'
	option data_dir '/var/lib/innernet'

config network 'home'
	option enabled '1'
```

`/etc/init.d/innernet enable && /etc/init.d/innernet start` runs one procd
instance per enabled network section (mirrors the systemd
`innernet@.service` template used on other distros: one unit per network,
so one network's failures/restarts don't affect the others).

Notes on the defaults:
- `data_dir` defaults to `/var/lib/innernet`, which is on OpenWrt's tmpfs
  (`/var` → `/tmp`) — it's just a peer/CIDR cache that gets rebuilt from
  the coordinating server on the next fetch, so losing it on reboot is
  fine, and it avoids flash writes.
- `hosts_path` defaults to a tmpfs path rather than `/etc/hosts` for the
  same reason: peer endpoints (and therefore this file) can be rewritten
  fairly often, and `/etc/hosts` lives on flash. Wire it into dnsmasq with
  `uci add_list dhcp.@dnsmasq[0].addnhosts='/tmp/hosts/innernet'` if you
  want peer names resolvable.

## Making the interface visible to netifd/LuCI

`/etc/init.d/innernet` brings the WireGuard device up on its own — this
step is optional, and only matters if you want the interface to show up
under LuCI's Network → Interfaces, be assignable to a firewall zone, or be
fed to dnsmasq via a logical interface rather than a raw device name.

Add a matching `interface` section to `/etc/config/network`, named exactly
the same as the `network` section in `/etc/config/innernet` (and the actual
device name shown by `innernet show`):

```
config interface 'home'
	option proto 'innernet'
```

That's it — no address/gateway/etc. to configure, since the innernet daemon
already owns bringing the device up and assigning it an address; the
`netifd` proto handler (`/lib/netifd/proto/innernet.sh`, from the
`innernet` package) just reports the existing device's state to netifd.
Without `luci-proto-innernet` installed, LuCI will still show "Unsupported
protocol" for this section even though it works fine everywhere else
(`ifstatus home`, firewall zone assignment, `/etc/init.d/network reload`,
etc. all work without it).

## Rebuilding from a fresh checkout (e.g. after an OpenWrt upgrade)

Full runbook assuming a completely fresh system — no buildroot, no
toolchain, nothing cached. This is also what "rebuild after upgrading the
router" means in practice: `kmod-wireguard` (an `innernet` dependency) is
tied to the exact kernel ABI of the target firmware, so an `.apk` built
against one OpenWrt release isn't guaranteed to work after the router
moves to another — don't just reuse an old build.

### 0. Before you upgrade the router

Back up `/etc/innernet` — it holds the node's WireGuard private key and
per-network config written by `innernet install`, and isn't covered by
OpenWrt's normal `/etc/config` sysupgrade backup:

```
scp -r root@router:/etc/innernet ./innernet-backup-$(date +%Y%m%d)
```

Or, better, make this permanent so every future sysupgrade includes it
automatically:

```
ssh root@router "echo '/etc/innernet' >> /etc/sysupgrade.conf"
```

`/etc/config/innernet` (UCI settings) and `/etc/config/network` (the
`innernet` proto stanza, if you added one) are already covered by the
default sysupgrade backup — nothing to do there.

### 1. Match the buildroot to the router's new firmware version

After the router's upgraded, check exactly what it's running:

```
ssh root@router cat /etc/openwrt_release
```

Clone the buildroot and check out the matching release, not `main`:

```
git clone https://git.openwrt.org/openwrt/openwrt.git
cd openwrt
git checkout v24.10.3   # match DISTRIB_RELEASE from /etc/openwrt_release
```

### 2. Install build prerequisites

Follow OpenWrt's own list for your distro:
https://openwrt.org/docs/guide-developer/toolchain/install-buildsystem

On Fedora-family hosts, also grab `perl-JSON-PP` — `scripts/feeds install`
fails with `Can't locate JSON/PP.pm` without it:

```
sudo dnf install -y perl-JSON-PP
```

Leave yourself generous free disk space: `lang/rust` builds the Rust
compiler and LLVM from source as a host tool (`PKG_HOST_ONLY:=1`), which is
the single biggest consumer.

### 3. Clone your innernet fork and set up feeds

```
git clone https://github.com/jebotz/innernet.git
cd openwrt   # back in the buildroot
./scripts/feeds update -a
./scripts/feeds install -a -p packages   # brings in lang/rust
./scripts/feeds install -a -p luci       # brings in luci-base
```

Add `src-link innernet /path/to/innernet/openwrt` to `feeds.conf.default`,
then:

```
./scripts/feeds update innernet
./scripts/feeds install -a -p innernet
```

### 4. Configure

`make menuconfig` — set the target/profile and select both `innernet` and
`luci-proto-innernet`, as described above in "Configure".

That selection isn't optional for a standalone package build: `make
package/<name>/compile` silently no-ops for anything not selected in
`.config` (`CONFIG_PACKAGE_<name>` unset) — no warning, it just skips the
real build. (`make DEVELOPER=1 package/.../compile` bypasses this, but
force-builds every *other* unselected package it happens to touch along
the way too, which can fail on things that have nothing to do with your
package — hit a broken `libquadmath` toolchain sub-build this way once.
Menuconfig selection is the reliable path.)

### 5. Build the one-time prerequisite chain

On a fresh checkout, these need to run once, in order, before any package
will compile:

```
make tools/install
make toolchain/install
make target/linux/compile
```

### 6. Build the packages

```
make package/innernet/compile V=s
make package/luci-proto-innernet/compile V=s
```

Output lands in `bin/packages/<arch>/innernet/` (see "Build" above) —
`<arch>` was `mipsel_24kc` for mt7621; confirm it's unchanged for the new
release with `ls bin/packages/`.

### 7. Install on the router

```
scp bin/packages/*/innernet/{innernet-*.apk,luci-proto-innernet-*.apk} root@router:/tmp/
ssh root@router
apk add --allow-untrusted /tmp/innernet-*.apk /tmp/luci-proto-innernet-*.apk
```

If `/etc/innernet` didn't come back automatically (see step 0), restore it
now. `/etc/config/network`'s `innernet` proto stanza and
`/etc/config/innernet` should already be in place from the sysupgrade
backup, so `/etc/init.d/network reload` (or a reboot) should be all that's
needed to pick everything back up.

## Known open items before this is upstream-ready

- `PKG_SOURCE_URL`/`PKG_SOURCE_VERSION` need to point at a real tagged
  release rather than an arbitrary commit on a personal fork.
- Only `ramips/mt7621` has been exercised. `RUST_ARCH_DEPENDS` (from
  `lang/rust`) already covers `mipsel` generally, so other targets are
  plausible but untested — the main unknowns are less about Rust/mipsel
  and more about whatever's target-specific in `wireguard-control`'s
  netlink backend.
- No `/etc/uci-defaults` script yet to scaffold a first `network` section
  automatically after `innernet install` — currently that edit is manual.
