include $(TOPDIR)/rules.mk

PKG_NAME:=innernet
PKG_VERSION:=2.0.0
PKG_RELEASE:=1

PKG_SOURCE_PROTO:=git
# TODO: point this at wherever you're pushing this repo/branch. Must be
# reachable (anonymously, over https) from the machine doing the OpenWrt
# build. PKG_SOURCE_VERSION pins an exact commit; bump it (and PKG_RELEASE)
# every time you want the feed to pick up new source.
PKG_SOURCE_URL:=https://github.com/jebotz/innernet.git
PKG_SOURCE_VERSION:=dbdb0097b397fa5b10566ae58d33c699142102f2
PKG_MIRROR_HASH:=skip

PKG_MAINTAINER:=Juergen Botz <jurgen@botz.org>
PKG_LICENSE:=MIT
PKG_LICENSE_FILES:=LICENSE

PKG_BUILD_DEPENDS:=rust/host
PKG_BUILD_PARALLEL:=1

# client/Cargo.toml is a workspace member; cargo resolves its path
# dependencies (innernet-shared, innernet-client-core, wireguard-control,
# ...) against the rest of the checked-out workspace, so the whole repo
# needs to be fetched even though only the client binary gets built.
MAKE_PATH:=client

include $(INCLUDE_DIR)/package.mk
# Not "../../lang/rust/rust-package.mk": that relative path only works for
# packages that live inside the same feed as lang/rust (i.e. the real
# openwrt/packages feed). We're a separate feed, so reference it via
# $(TOPDIR) instead.
include $(TOPDIR)/feeds/packages/lang/rust/rust-package.mk

define Package/innernet
  SECTION:=net
  CATEGORY:=Network
  SUBMENU:=VPN
  TITLE:=innernet WireGuard mesh network client
  URL:=https://github.com/tonarino/innernet
  DEPENDS:=$(RUST_ARCH_DEPENDS) +kmod-wireguard
endef

define Package/innernet/description
  innernet is a system for creating WireGuard-based mesh networks
  coordinated by a central server. This package provides the client
  binary used to redeem invitations and keep a local interface's peer
  list up to date.
endef

define Package/innernet/conffiles
/etc/config/innernet
endef

define Package/innernet/install
	$(INSTALL_DIR) $(1)/usr/bin
	$(INSTALL_BIN) $(PKG_INSTALL_DIR)/bin/innernet $(1)/usr/bin/

	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./files/innernet.init $(1)/etc/init.d/innernet

	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_CONF) ./files/innernet.config $(1)/etc/config/innernet

	$(INSTALL_DIR) $(1)/etc/innernet
endef

$(eval $(call RustBinPackage,innernet))
$(eval $(call BuildPackage,innernet))
