#
# This is free software, licensed under the Apache License, Version 2.0 .
#

include $(TOPDIR)/rules.mk

LUCI_TITLE:=Support for innernet
LUCI_DESCRIPTION:=Lets a WireGuard interface brought up by the innernet \
	daemon (see the innernet package) be recognized under Network > \
	Interfaces, assigned to a firewall zone, and picked up by dnsmasq.
LUCI_DEPENDS:=+innernet +luci-base

PKG_LICENSE:=Apache-2.0
PKG_MAINTAINER:=Juergen Botz <jurgen@botz.org>

# Not "../../luci.mk": that relative path only works for packages that live
# inside the real luci feed itself (e.g. feeds/luci/protocols/*). We're a
# separate feed, so reference it via $(TOPDIR) instead -- same reasoning as
# the rust-package.mk include in net/innernet/Makefile.
include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
