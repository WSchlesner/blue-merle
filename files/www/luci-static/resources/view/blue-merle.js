'use strict';
'require view';
'require fs';
'require ui';
'require rpc';

var css = '                             \
    .controls {                         \
        display: flex;                  \
        margin: .5em 0 1em 0;           \
        flex-wrap: wrap;                \
        justify-content: space-around;  \
    }                                   \
                                        \
    .controls > * {                     \
        padding: .25em;                 \
        white-space: nowrap;            \
        flex: 1 1 33%;                  \
        box-sizing: border-box;         \
        display: flex;                  \
        flex-wrap: wrap;                \
    }                                   \
                                        \
    .controls > *:first-child,          \
    .controls > * > label {             \
        flex-basis: 100%;               \
        min-width: 250px;               \
    }                                   \
                                        \
    .controls > *:nth-child(2),         \
    .controls > *:nth-child(3) {        \
        flex-basis: 20%;                \
    }                                   \
                                        \
    .controls > * > .btn {              \
        flex-basis: 20px;               \
        text-align: center;             \
    }                                   \
                                        \
    .controls > * > * {                 \
        flex-grow: 1;                   \
        align-self: center;             \
    }                                   \
                                        \
    .controls > div > input {           \
        width: auto;                    \
    }                                   \
                                        \
    .td.version,                        \
    .td.size {                          \
        white-space: nowrap;            \
    }                                   \
                                        \
    ul.deps, ul.deps ul, ul.errors {    \
        margin-left: 1em;               \
    }                                   \
                                        \
    ul.deps li, ul.errors li {          \
        list-style: none;               \
    }                                   \
                                        \
    ul.deps li:before {                 \
        content: "↳";                   \
        display: inline-block;          \
        width: 1em;                     \
        margin-left: -1em;              \
    }                                   \
                                        \
    ul.deps li > span {                 \
        white-space: nowrap;            \
    }                                   \
                                        \
    ul.errors li {                      \
        color: #c44;                    \
        font-size: 90%;                 \
        font-weight: bold;              \
        padding-left: 1.5em;            \
    }                                   \
                                        \
    ul.errors li:before {               \
        content: "⚠";                   \
        display: inline-block;          \
        width: 1.5em;                   \
        margin-left: -1.5em;            \
    }                                   \
';

var isReadonlyView = !L.hasViewPermission() || null;

var callMountPoints = rpc.declare({
    object: 'luci',
    method: 'getMountPoints',
    expect: { result: [] }
});

var packages = {
    available: { providers: {}, pkgs: {} },
    installed: { providers: {}, pkgs: {} }
};

var languages = ['en'];

var currentDisplayMode = 'available', currentDisplayRows = [];

function handleReset(ev)
{
}

function callBlueMerle(arg) {
    const cmd = "/usr/libexec/blue-merle";
    var prom = fs.exec(cmd, [arg]);
    return prom.then(
        function(res) {
            console.log("Blue Merle arg", arg, "res", res);
            if (res.code != 0) {
                throw new Error("Return code " + res.code);
            } else {
                return res.stdout;
            }
        }
    ).catch(
        function(err) {
            console.log("Error calling Blue Merle", arg, err);
            throw err;
        }
    );
}

function readIMEI() {
    return callBlueMerle("read-imei");
}

function randomIMEI() {
    callBlueMerle("random-imei").then(
        function(res){
            readIMEI().then(
                console.log("new IMEI", imei)
            );
        }
    ).catch(
        function(err){
            console.log("Error", err);
        }
    );
}

function readIMSI() {
    return callBlueMerle("read-imsi");
}

function handleConfig(ev) {
}

function handleShutdown(ev)
{
    return callBlueMerle("shutdown")
}

function handleRemove(ev)
{
}

function handleSimSwap(ev) {
    const spinnerID = 'swap-spinner-id';
    var dlg = ui.showModal(_('Starting SIM swap...'),
        [
            E('p', { 'class': 'spinning', 'id': spinnerID },
                _('Shutting down modem…')
             )
        ]
    );
    callBlueMerle("shutdown-modem").then(
        function(res) {
            dlg.appendChild(
                E('pre', { 'class': 'result'},
                    res
                )
            );
            dlg.appendChild(
                E('p', { 'class': 'text'},
                    _("Generating Random IMEI")
                )
            );
            callBlueMerle("random-imei").then(
                function(res) {
                    document.getElementById(spinnerID).style = "display:none";
                    dlg.appendChild(
                        E('div', { 'class': 'text'},
                          [
                            E('p', { 'class': 'text'},
                                _("IMEI set:") + " " + res
                            ),
                            E('p', { 'class': 'text'},
                                _("Please shutdown the device, swap the SIM, then go to another place before booting")
                            ),
                            E('button', { 'class': 'btn cbi-button-positive', 'click': handleShutdown, 'disabled': isReadonlyView },
                                [ _('Shutdown…') ]
                            )
                          ]
                        )
                    )
                }
            ).catch(
                function(err) {
                    dlg.appendChild(
                        E('p',{'class': 'error'},
                            _('Error setting IMEI! ') + err
                        )
                    )
                }
            );
        }
    ).catch(
        function(err) {
            dlg.appendChild(
                E('p',{'class': 'error'},
                    _('Error! ') + err
                )
            )
        }
    );
}

function handleOpkg(ev)
{
}

function handleUpload(ev)
{
}

function handleInput(ev) {
}

function checkServiceState(service) {
    // Check the state of the service
    return callBlueMerle('status-' + service).then(
        function(res) {
            return res.trim() === 'enabled';
        }
    ).catch(
        function(err) {
            console.log("Error checking service state", service, err);
            return false;
        }
    );
}

function toggleService(service, button) {
    checkServiceState(service).then(
        function(isEnabled) {
            var command = isEnabled ? 'disable-' + service : 'enable-' + service;
            return callBlueMerle(command).then(
                function(res) {
                    console.log("Service", service, "command", command, "result", res);
                    button.textContent = isEnabled ? 'Enable ' + service : 'Disable ' + service;
                }
            ).catch(
                function(err) {
                    console.log("Error toggling service", service, err);
                }
            );
        }
    );
}

return view.extend({
    load: function() {
    },

    render: function(listData) {
        var query = decodeURIComponent(L.toArray(location.search.match(/\bquery=([^=]+)\b/))[1] || '');

        const imeiInputID = 'imei-input';
        const imsiInputID = 'imsi-input';

        var view = E([], [
            E('style', { 'type': 'text/css' }, [ css ]),

            E('h2', {}, _('Blue Merle')),

            E('div', { 'class': 'controls' }, [
                E('div', {}, [
                    E('label', {}, _('IMEI') + ':'),
                    E('span', { 'class': 'control-group' }, [
                        E('input', { 'id':imeiInputID, 'type': 'text', 'name': 'filter', 'placeholder': _('e.g. 31428392718429'), 'minlength':14, 'maxlenght':14, 'required':true, 'value': query, 'input': handleInput, 'disabled': true })
                    ])
                ]),

                E('div', {}, [
                    E('label', {}, _('IMSI') + ':'),
                    E('span', { 'class': 'control-group' }, [
                        E('input', { 'id':imsiInputID, 'type': 'text', 'name': 'filter', 'placeholder': _('e.g. 31428392718429'), 'minlength':14, 'maxlenght':14, 'required':true, 'value': query, 'input': handleInput, 'disabled': true })
                    ])
                ])
            ]),

            E('div', {}, [
                E('label', {}, _('Actions') + ':'), ' ',
                E('span', { 'class': 'control-group' }, [
                    E('button', { 'class': 'btn cbi-button-positive', 'data-command': 'update', 'click': handleSimSwap, 'disabled': isReadonlyView }, [ _('SIM swap…') ]), ' ',
					//, E('button', { 'class': 'btn cbi-button-action', 'click': handleUpload, 'disabled': isReadonlyView }, [ _('IMEI change…') ]), ' '
					//, E('button', { 'class': 'btn cbi-button-neutral', 'click': handleConfig }, [ _('Shred config…') ])
                ])
            ]),

            //Spacer
            E('br'),

            //Randomization Div
			E('div', {}, [
                E('label', {}, _('Randomization') + ':'), ' ',
                E('span', { 'class': 'control-group' }, [
                    (function() {
                        var button = E('button', { 'class': 'btn cbi-button', 'click': function() { toggleService('hostname', this); } }, [ _('Enable Hostname') ]);
                        checkServiceState('hostname').then(state => {
                            button.textContent = state ? 'Disable Hostname' : 'Enable Hostname';
                        });
                        return button;
                    })(), ' ',
                    (function() {
                        var button = E('button', { 'class': 'btn cbi-button', 'click': function() { toggleService('bssid', this); } }, [ _('Enable BSSID/MAC') ]);
                        checkServiceState('bssid').then(state => {
                            button.textContent = state ? 'Disable BSSID/MAC' : 'Enable BSSID/MAC';
                        });
                        return button;
                    })(), ' ',
                    (function() {
                        var button = E('button', { 'class': 'btn cbi-button', 'click': function() { toggleService('ssid', this); } }, [ _('Enable SSID') ]);
                        checkServiceState('ssid').then(state => {
                            button.textContent = state ? 'Disable SSID' : 'Enable SSID';
                        });
                        return button;
                    })(), ' ',
                    (function() {
                        var button = E('button', { 'class': 'btn cbi-button', 'click': function() { toggleService('password', this); } }, [ _('Enable Password') ]);
                        checkServiceState('password').then(state => {
                            button.textContent = state ? 'Disable Password' : 'Enable Password';
                        });
                        return button;
                    })()
                ])
            ])
        ]);

        readIMEI().then(
            function(imei) {
                const e = document.getElementById(imeiInputID);
                console.log("Input: ", e, e.placeholder, e.value);
                e.value = imei;
            }
        ).catch(
            function(err){
                console.log("Error: ", err)
            }
        );

        readIMSI().then(
            function(imsi) {
                const e = document.getElementById(imsiInputID);
                e.value = imsi;
            }
        ).catch(
            function(err){
                const e = document.getElementById(imsiInputID);
                e.value = "No IMSI found";
            }
        );

        return view;
    },

    handleSave: null,
    handleSaveApply: null,
    handleReset: null
});