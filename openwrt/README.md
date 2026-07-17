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
```

The resulting `.apk` lands under `bin/packages/mipsel_24kc/innernet/`.
Install it on the router with `apk install` (or bake it into a full image
via `make` at the top level once it's selected in menuconfig).

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
