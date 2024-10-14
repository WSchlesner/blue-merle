#!/usr/bin/env ash

# This script provides helper functions for blue-merle

UNICAST_MAC_GEN () {
    loc_mac_numgen=`python3 -c "import random; print(f'{random.randint(0,2**48) & 0b111111101111111111111111111111111111111111111111:0x}'.zfill(12))"`
    loc_mac_formatted=$(echo "$loc_mac_numgen" | sed 's/^\(..\)\(..\)\(..\)\(..\)\(..\)\(..\).*$/\1:\2:\3:\4:\5:\6/')
    echo "$loc_mac_formatted"
}

#Randomize BSSID & MAC Addrs
RANDOMIZE_MACADDR () {
    # This changes the MAC address clients see when connecting to the WiFi spawned by the device.
    # You can check with "arp -a" that your endpoint, e.g. your laptop, sees a different MAC after a reboot of the Mudi.
    uci set network.@device[1].macaddr=$(UNICAST_MAC_GEN)
    # Here we change the MAC address the upstream WiFi sees
    uci set glconfig.general.macclone_addr=$(UNICAST_MAC_GEN)
    uci commit network
    # Changing the BSSID/MAC on the WiFi Interfaces
    uci set wireless.@wifi-iface[0].macaddr=$(UNICAST_MAC_GEN)
    uci set wireless.@wifi-iface[1].macaddr=$(UNICAST_MAC_GEN)
    # Get all interfaces exactly matching "sta" from the uci show command
    stainterfaces=$(uci show wireless | grep -E '\.sta=' | cut -d'.' -f2 | cut -d'=' -f1 | uniq)
    # Loop through each sta interface
    for iface in $stainterfaces; do    
        uci set wireless.$iface.macaddr=$(UNICAST_MAC_GEN)
    done
}
    
#Generate Pseudo Random SSID for WiFi Interfaces
RANDOMIZE_SSID() {
    NEW_SSID="Mudi_$(head /dev/urandom | tr -dc A-Za-z0-9 | head -c 5)"
    uci set wireless.@wifi-iface[0].ssid="$NEW_SSID"
    uci set wireless.@wifi-iface[1].ssid="$NEW_SSID"
}

#Randomzie Password for the WiFi Interfaces
RANDOMIZE_PASSWORD(){
    #Generate Random Password for WiFi Interfaces
    NEW_PASSWORD=$(head /dev/urandom | tr -dc A-Za-z0-9 | head -c 8)
    uci set wireless.@wifi-iface[0].key="$NEW_PASSWORD"
    uci set wireless.@wifi-iface[1].key="$NEW_PASSWORD"
}

#Randomize Hostname
RANDOMIZE_HOSTNAME(){
    RANDOM_SUFFIX=$(head /dev/urandom | tr -dc A-Za-z0-9 | head -c 4)
    NEW_HOSTNAME="Mudi_$RANDOM_SUFFIX"
    echo $NEW_HOSTNAME > /proc/sys/kernel/hostname
    uci set system.@system[0].hostname="$NEW_HOSTNAME"
    uci commit system
    /etc/init.d/log restart
}

#Shutdown WiFi Interfaces
WIFI_DOWN(){
	wifi down
}

#Reload WiFi Interfaces, DNSMasq, and Network
WIFI_RELOAD(){
	wifi commit wireless
    sleep 1
    wifi reload
    sleep 2
    wifi up
    sleep 2
    /etc/init.d/dnsmasq restart
    sleep 5
    /etc/init.d/network restart
}

READ_ICCID() {
    gl_modem AT AT+CCID
}

READ_IMEI () {
	local answer=1
	while [[ "$answer" -eq 1 ]]; do
	        local imei=$(gl_modem AT AT+GSN | grep -w -E "[0-9]{14,15}")
	        if [[ $? -eq 1 ]]; then
                	echo -n "Failed to read IMEI. Try again? (Y/n): "
	                read answer
	                case $answer in
	                        n*) answer=0;;
	                        N*) answer=0;;
	                        *) answer=1;;
	                esac
	                if [[ $answer -eq 0 ]]; then
	                        exit 1
	                fi
	        else
	                answer=0
	        fi
	done
	echo $imei
}

READ_IMSI () {
	local answer=1
	while [[ "$answer" -eq 1 ]]; do
	        local imsi=$(gl_modem AT AT+CIMI | grep -w -E "[0-9]{6,15}")
	        if [[ $? -eq 1 ]]; then
                	echo -n "Failed to read IMSI. Try again? (Y/n): "
	                read answer
	                case $answer in
	                        n*) answer=0;;
	                        N*) answer=0;;
	                        *) answer=1;;
	                esac
	                if [[ $answer -eq 0 ]]; then
	                        exit 1
	                fi
	        else
	                answer=0
	        fi
	done
	echo $imsi
}

GENERATE_IMEI() {
    local seed=$(head -100 /dev/urandom | tr -dc "0123456789" | head -c10)
    local imei=$(lua /lib/blue-merle/luhn.lua $seed)
    echo -n $imei
}

SET_IMEI() {
    local imei="$1"

    if [[ ${#imei} -eq 14 ]]; then
        gl_modem AT AT+EGMR=1,7,${imei}
    else
        echo "IMEI is ${#imei} not 14 characters long"
    fi
}

CHECK_ABORT () {
        sim_change_switch=`cat /tmp/sim_change_switch`
        if [[ "$sim_change_switch" = "off" ]]; then
                echo '{ "msg": "SIM change      aborted." }' > /dev/ttyS0
                sleep 1
                exit 1
        fi
}
