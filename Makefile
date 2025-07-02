include $(TOPDIR)/rules.mk

PKG_NAME:=blue-merle
PKG_VERSION:=2.0.5
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
	
	# Install init scripts with executable permissions
	$(INSTALL_BIN) ./files/etc/init.d/blue-merle-bssid-mac $(1)/etc/init.d/
	$(INSTALL_BIN) ./files/etc/init.d/blue-merle-hostname $(1)/etc/init.d/
	$(INSTALL_BIN) ./files/etc/init.d/blue-merle-password $(1)/etc/init.d/
	$(INSTALL_BIN) ./files/etc/init.d/blue-merle-ssid $(1)/etc/init.d/
	$(INSTALL_BIN) ./files/etc/init.d/blue-merle-wifi-down $(1)/etc/init.d/
	$(INSTALL_BIN) ./files/etc/init.d/blue-merle-wifi-reload $(1)/etc/init.d/
	$(INSTALL_BIN) ./files/etc/init.d/volatile-client-macs $(1)/etc/init.d/
	
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
	
	uci set switch-button.@main[0].func='sim'
	uci commit switch-button

	# Enable and start services
	/etc/init.d/volatile-client-macs enable
	/etc/init.d/blue-merle-bssid-mac enable

	/etc/init.d/gl_clients start

	echo {\"msg\": \"Successfully installed Blue Merle\"} > /dev/ttyS0
endef

define Package/blue-merle/prerm
	#!/bin/sh
	[ -n "$${IPKG_INSTROOT}" ] && exit 0	# if run within buildroot exit
	
	# Stop and disable services
	/etc/init.d/volatile-client-macs stop
	/etc/init.d/blue-merle-bssid-mac stop
	
	/etc/init.d/volatile-client-macs disable
	/etc/init.d/blue-merle-bssid-mac disable
endef

define Package/blue-merle/postrm
	#!/bin/sh
	[ -n "$${IPKG_INSTROOT}" ] && exit 0	# if run within buildroot exit
	
	uci set switch-button.@main[0].func='tor'
	uci commit switch-button
	
	# Clean up any remaining files
	rm -rf /lib/blue-merle
endef

$(eval $(call BuildPackage,blue-merle))