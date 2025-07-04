include $(TOPDIR)/rules.mk

PKG_NAME:=blue-merle
PKG_VERSION:=4.0.0
PKG_RELEASE:=$(AUTORELEASE)

PKG_MAINTAINER:=Matthias <matthias@srlabs.de>
PKG_LICENSE:=BSD-3-Clause

include $(INCLUDE_DIR)/package.mk

define Package/blue-merle
	SECTION:=utils
	CATEGORY:=Utilities
	EXTRA_DEPENDS:=luci-base, gl-sdk4-mcu, coreutils-shred, python3-pyserial
	TITLE:=Anonymity Enhancements for GL-E750 Mudi
endef

define Package/blue-merle/description
	The blue-merle package enhances anonymity and reduces forensic traceability of the GL-E750 Mudi 4G mobile wi-fi router
endef

define Build/Configure
endef

define Build/Compile
endef

define Package/blue-merle/install
	# Create directory structure
	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_DIR) $(1)/etc/gl-switch.d
	$(INSTALL_DIR) $(1)/etc/uci-defaults
	$(INSTALL_DIR) $(1)/usr/bin
	$(INSTALL_DIR) $(1)/usr/libexec
	$(INSTALL_DIR) $(1)/lib/blue-merle
	$(INSTALL_DIR) $(1)/usr/share/luci/menu.d
	$(INSTALL_DIR) $(1)/usr/share/rpcd/acl.d
	$(INSTALL_DIR) $(1)/www/luci-static/resources/view
	
	# Install configuration files
	$(INSTALL_DATA) ./files/etc/config/blue-merle $(1)/etc/config/
	
	# Install init scripts - services that auto-start get executable permissions
	$(INSTALL_BIN) ./files/etc/init.d/blue-merle-bssid-mac $(1)/etc/init.d/
	$(INSTALL_BIN) ./files/etc/init.d/volatile-client-macs $(1)/etc/init.d/
	
	# Install init scripts without executable permissions to prevent auto-execution
	$(INSTALL_DATA) ./files/etc/init.d/blue-merle-hostname $(1)/etc/init.d/
	$(INSTALL_DATA) ./files/etc/init.d/blue-merle-password $(1)/etc/init.d/
	$(INSTALL_DATA) ./files/etc/init.d/blue-merle-ssid $(1)/etc/init.d/
	
	# Install gl-switch.d scripts
	$(INSTALL_BIN) ./files/etc/gl-switch.d/sim.sh $(1)/etc/gl-switch.d/
	
	# Install uci-defaults
	$(INSTALL_BIN) ./files/etc/uci-defaults/blue-merle $(1)/etc/uci-defaults/
	
	# Install user binaries
	$(INSTALL_BIN) ./files/usr/bin/blue-merle $(1)/usr/bin/
	$(INSTALL_BIN) ./files/usr/bin/blue-merle-switch-stage1 $(1)/usr/bin/
	$(INSTALL_BIN) ./files/usr/bin/blue-merle-switch-stage2 $(1)/usr/bin/
	$(INSTALL_BIN) ./files/usr/bin/sim_switch $(1)/usr/bin/
	
	# Install libexec
	$(INSTALL_BIN) ./files/usr/libexec/blue-merle $(1)/usr/libexec/
	
	# Install library files
	$(INSTALL_BIN) ./files/lib/blue-merle/functions.sh $(1)/lib/blue-merle/
	$(INSTALL_BIN) ./files/lib/blue-merle/imei_generate.py $(1)/lib/blue-merle/
	$(INSTALL_DATA) ./files/lib/blue-merle/luhn.lua $(1)/lib/blue-merle/
	$(INSTALL_DATA) ./files/lib/blue-merle/words $(1)/lib/blue-merle/
	
	# Install LuCI web interface files
	$(INSTALL_DATA) ./files/usr/share/luci/menu.d/luci-app-blue-merle.json $(1)/usr/share/luci/menu.d/
	$(INSTALL_DATA) ./files/usr/share/rpcd/acl.d/luci-app-blue-merle.json $(1)/usr/share/rpcd/acl.d/
	$(INSTALL_DATA) ./files/www/luci-static/resources/view/blue-merle.js $(1)/www/luci-static/resources/view/
endef

define Package/blue-merle/preinst
	#!/bin/sh
	[ -n "$${IPKG_INSTROOT}" ] && exit 0	# if run within buildroot exit
	
	ABORT_GLVERSION () {
		echo
		if [ -f "/tmp/sysinfo/model" ] && [ -f "/etc/glversion" ]; then
			echo "You have a `cat /tmp/sysinfo/model`, running firmware version `cat /etc/glversion`."
		fi
		echo "blue-merle has only been tested with GL-E750 Mudi Versions up to 4.3.26"
		echo "The device or firmware version you are using have not been verified to work with blue-merle."
		echo -n "Would you like to continue on your own risk? (y/N): "
		read answer
		case $$answer in
				y*) answer=0;;
				Y*) answer=0;;
				*) answer=1;;
		esac
		if [[ "$$answer" -eq 0 ]]; then
			exit 0
		else
			exit 1
		fi
	}

	CHECK_MCUVERSION () {
		# Add MCU version check if needed
		echo "Checking MCU version..."
	}

	if grep -q "GL.iNet GL-E750" /proc/cpuinfo; then
	    GL_VERSION=$$(cat /etc/glversion)
	    case $$GL_VERSION in
		4.3.26)
		    echo Version $$GL_VERSION is supported
		    exit 0
		    ;;
		4.*)
	            echo Version $$GL_VERSION is *probably* supported
	            ABORT_GLVERSION
	            ;;
	        *)
	            echo Unknown version $$GL_VERSION
	            ABORT_GLVERSION
	            ;;
        esac
        CHECK_MCUVERSION
	else
		ABORT_GLVERSION
	fi

    # Our volatile-mac service gets started during the installation
    # but it modifies the client database held by the gl_clients process.
    # So we stop that process now, have the database put onto volatile storage
    # and start the service after installation
    /etc/init.d/gl_clients stop
endef

define Package/blue-merle/postinst
	#!/bin/sh
	[ -n "$${IPKG_INSTROOT}" ] && exit 0	# if run within buildroot exit
	
	# Only set switch-button if the config exists
	if uci -q get switch-button.@main[0] >/dev/null 2>&1; then
		uci set switch-button.@main[0].func='sim'
		uci commit switch-button
	fi

	# Only enable the two services that should run by default
	/etc/init.d/volatile-client-macs enable
	/etc/init.d/blue-merle-bssid-mac enable

	# Restart gl_clients service
	/etc/init.d/gl_clients start

	echo {\"msg\": \"Successfully installed Blue Merle\"} > /dev/ttyS0
endef

define Package/blue-merle/prerm
	#!/bin/sh
	[ -n "$${IPKG_INSTROOT}" ] && exit 0	# if run within buildroot exit
	
	/etc/init.d/gl_clients stop 2>/dev/null || true

	# Only disable services (disable automatically stops them first)
	/etc/init.d/volatile-client-macs disable 2>/dev/null || true
	/etc/init.d/blue-merle-bssid-mac disable 2>/dev/null || true
	/etc/init.d/blue-merle-hostname disable 2>/dev/null || true
	/etc/init.d/blue-merle-password disable 2>/dev/null || true
	/etc/init.d/blue-merle-ssid disable 2>/dev/null || true
endef

define Package/blue-merle/postrm
	#!/bin/sh
	[ -n "$${IPKG_INSTROOT}" ] && exit 0	# if run within buildroot exit
	
	# Clean up UCI configuration
	uci -q delete blue-merle 2>/dev/null || true
	uci commit 2>/dev/null || true

	# Only restore switch-button if the config exists
	if uci -q get switch-button.@main[0] >/dev/null 2>&1; then
		uci set switch-button.@main[0].func='tor'
		uci commit switch-button
	fi
	
	# Clean up installed files and directories
	rm -rf /lib/blue-merle/*
	rm -f /etc/config/blue-merle
	rm -f /usr/bin/blue-merle
	rm -f /usr/bin/blue-merle-switch-stage1
	rm -f /usr/bin/blue-merle-switch-stage2
	rm -f /usr/bin/sim_switch
	rm -f /usr/libexec/blue-merle
	rm -f /etc/gl-switch.d/sim.sh
	rm -f /etc/uci-defaults/blue-merle
	rm -f /etc/init.d/blue-merle-bssid-mac
	rm -f /etc/init.d/volatile-client-macs
	rm -f /etc/init.d/blue-merle-hostname
	rm -f /etc/init.d/blue-merle-password
	rm -f /etc/init.d/blue-merle-ssid
	
	# Clean up LuCI web interface files
	rm -f /usr/share/luci/menu.d/luci-app-blue-merle.json
	rm -f /usr/share/rpcd/acl.d/luci-app-blue-merle.json
	rm -f /www/luci-static/resources/view/blue-merle.js

	# Clear LuCI cache to remove broken references
	rm -f /tmp/luci-indexcache* 2>/dev/null || true
	rm -rf /tmp/luci-modulecache* 2>/dev/null || true
	
	# Restart gl_clients service (in case it was stopped during removal)
	/etc/init.d/gl_clients start 2>/dev/null || true
	
	echo "Blue Merle package removed successfully"
endef

$(eval $(call BuildPackage,blue-merle))