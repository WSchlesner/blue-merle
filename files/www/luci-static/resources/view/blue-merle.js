'use strict';
'require view';
'require fs';
'require ui';
'require rpc';

const CONFIG_PATH = '/etc/config/blue-merle';

var css = '                             \
    .bm-main-controls {                 \
        display: grid;                  \
        grid-template-columns: 1fr 1fr; \
        gap: 1em;                       \
        margin: 1em 0;                  \
        align-items: start;             \
    }                                   \
                                        \
    .bm-control-group {                 \
        display: flex;                  \
        flex-direction: column;         \
        gap: 0.5em;                     \
    }                                   \
                                        \
    .bm-control-group label {           \
        font-weight: bold;              \
        color: #404040;                 \
        margin-bottom: 0.25em;          \
    }                                   \
                                        \
    .bm-control-group input {           \
        padding: 0.5em;                 \
        border: 1px solid #ccc;         \
        border-radius: 3px;             \
        background: #f8f8f8;            \
        font-family: monospace;         \
        font-size: 0.9em;               \
    }                                   \
                                        \
    .bm-control-group input:disabled {  \
        background: #f0f0f0;            \
        color: #666;                    \
    }                                   \
                                        \
    .bm-section {                       \
        margin: 1.5em 0;                \
        padding: 0;                     \
    }                                   \
                                        \
    .bm-section h3 {                    \
        margin: 0 0 1em 0;              \
        font-size: 1.1em;              \
        font-weight: bold;              \
        color: #404040;                 \
        border-bottom: 1px solid #ccc;  \
        padding-bottom: 0.5em;          \
    }                                   \
                                        \
    .bm-form-group {                    \
        display: flex;                  \
        align-items: center;            \
        margin: 0.75em 0;               \
        min-height: 2.5em;              \
    }                                   \
                                        \
    .bm-form-group label {              \
        display: inline-block;          \
        width: 12em;                    \
        font-weight: normal;            \
        margin-right: 1em;              \
        vertical-align: top;            \
        line-height: 1.8;               \
        color: #404040;                 \
    }                                   \
                                        \
    .bm-form-group select,              \
    .bm-form-group input {              \
        padding: 0.3em 0.5em;           \
        border: 1px solid #ccc;         \
        border-radius: 3px;             \
        background: #fff;               \
        min-width: 15em;                \
    }                                   \
                                        \
    .bm-form-group select:focus,        \
    .bm-form-group input:focus {        \
        border-color: #0099cc;          \
        outline: none;                  \
        box-shadow: 0 0 3px rgba(0,153,204,0.3); \
    }                                   \
                                        \
    .bm-button-group {                  \
        margin: 1em 0;                  \
        padding: 1em 0;                 \
        border-top: 1px solid #eee;     \
        display: flex;                  \
        gap: 0.5em;                     \
        align-items: center;            \
    }                                   \
                                        \
    .bm-button-group.primary {          \
        border-top: 2px solid #0099cc;  \
        background: #f8fcff;            \
        padding: 1em;                   \
        border-radius: 3px;             \
        margin: 1.5em 0;                \
    }                                   \
                                        \
    .bm-button-group label {            \
        font-weight: bold;              \
        color: #404040;                 \
        margin-right: 1em;              \
        min-width: 8em;                 \
    }                                   \
                                        \
    .bm-randomization-grid {            \
        display: grid;                  \
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); \
        gap: 0.5em;                     \
        margin-top: 0.5em;              \
    }                                   \
                                        \
    .bm-status-indicator {              \
        display: inline-block;          \
        width: 8px;                     \
        height: 8px;                    \
        border-radius: 50%;             \
        margin-right: 0.5em;            \
        background: #ccc;               \
    }                                   \
                                        \
    .bm-status-indicator.enabled {      \
        background: #4CAF50;            \
    }                                   \
                                        \
    .bm-status-indicator.disabled {     \
        background: #f44336;            \
    }                                   \
                                        \
    .bm-info-text {                     \
        color: #666;                    \
        font-size: 0.9em;              \
        margin-top: 0.5em;              \
        font-style: italic;             \
    }                                   \
                                        \
    .bm-warning {                       \
        background: #fff3cd;            \
        border: 1px solid #ffeaa7;      \
        border-radius: 3px;             \
        padding: 0.75em;                \
        margin: 1em 0;                  \
        color: #856404;                 \
    }                                   \
                                        \
    .bm-warning::before {               \
        content: "⚠ ";                  \
        font-weight: bold;              \
    }                                   \
                                        \
    #static-imei-input {                \
        width: 15em;                    \
        font-family: monospace;         \
    }                                   \
                                        \
    @media (max-width: 768px) {         \
        .bm-main-controls {             \
            grid-template-columns: 1fr; \
        }                               \
        .bm-randomization-grid {        \
            grid-template-columns: 1fr; \
        }                               \
        .bm-form-group {                \
            flex-direction: column;     \
            align-items: flex-start;    \
        }                               \
        .bm-form-group label {          \
            width: auto;                \
            margin-bottom: 0.5em;       \
        }                               \
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

function handleReset(ev) {
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
                function(imei) {
                    console.log("new IMEI", imei);
                    var input = document.getElementById('imei-input');
                    if (input) input.value = imei.trim();
                }
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
    var conf = {};

    const cmd = "/usr/libexec/blue-merle";
    var dlg = ui.showModal(_('Executing blue merle'), [
        E('p', { 'class': 'spinning' },
            _('Waiting for the <em>%h</em> command to complete…').format(cmd))
    ]);

    var argv = ["random-imei"];
    console.log("Calling ", cmd, argv);
    
    fs.exec_direct(cmd, argv, 'text').then(function(res) {
        console.log("Res:", res, "stdout", res.stdout, "stderr", res.stderr, "code", res.code);

        if (res.stdout)
            dlg.appendChild(E('pre', [ res.stdout ]));

        if (res.stderr) {
            dlg.appendChild(E('h5', _('Errors')));
            dlg.appendChild(E('pre', { 'class': 'errors' }, [ res.stderr ]));
        }

        console.log("Res.code: ", res.code);
        if (res.code !== 0)
            dlg.appendChild(E('p', _('The <em>%h %h</em> command failed with code <code>%d</code>.').format(cmd, argv, (res.code & 0xff) || -1)));

        dlg.appendChild(E('div', { 'class': 'right' },
            E('div', {
                'class': 'btn',
                'click': function() {
                    if (ui.menu && ui.menu.flushCache)
                        ui.menu.flushCache();
                    ui.hideModal();
                }
            }, _('Dismiss'))));
    }).catch(function(err) {
        ui.addNotification(null, E('p', _('Unable to execute <em>%s</em> command: %s').format(cmd, err)));
        ui.hideModal();
    });
}

function handleShutdown(ev) {
    return ui.showModal(_('System Shutdown'), [
        E('p', {}, _('The system is shutting down now. Please wait...')),
        E('div', { 'class': 'right' }, [
            E('button', { 
                'class': 'btn cbi-button-neutral',
                'click': ui.hideModal 
            }, _('Cancel')),
            E('button', { 
                'class': 'btn cbi-button-negative',
                'click': function() {
                    callBlueMerle("shutdown").then(function() {
                        ui.hideModal();
                    });
                }
            }, _('Confirm Shutdown'))
        ])
    ]);
}

function handleRemove(ev) {
}

function handleSimSwap(ev) {
    const spinnerID = 'swap-spinner-id';
    var dlg = ui.showModal(_('SIM Swap Process'),
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
                    _("Generating random IMEI...")
                )
            );
            callBlueMerle("random-imei").then(
                function(res) {
                    document.getElementById(spinnerID).style = "display:none";
                    dlg.appendChild(
                        E('div', { 'class': 'bm-section'},
                          [
                            E('p', { 'class': 'text'},
                                _("New IMEI assigned:") + " " + E('code', {}, res)
                            ),
                            E('div', { 'class': 'bm-warning' },
                                _("Important: Shutdown the device, swap the SIM card, then move to a different location before powering on.")
                            ),
                            E('div', { 'class': 'bm-button-group' }, [
                                E('button', { 'class': 'btn cbi-button-neutral', 'click': ui.hideModal },
                                    [ _('Cancel') ]
                                ),
                                E('button', { 'class': 'btn cbi-button-negative', 'click': handleShutdown, 'disabled': isReadonlyView },
                                    [ _('Shutdown Now') ]
                                )
                            ])
                          ]
                        )
                    )
                }
            ).catch(
                function(err) {
                    dlg.appendChild(
                        E('p',{'class': 'error'},
                            _('Error setting IMEI: ') + err
                        )
                    )
                }
            );
        }
    ).catch(
        function(err) {
            dlg.appendChild(
                E('p',{'class': 'error'},
                    _('Error: ') + err
                )
            )
        }
    );
}

function handleOpkg(ev) {
}

function handleUpload(ev) {
}

function handleInput(ev) {
}

// Function to check the state of the service
function checkServiceState(service) {
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

// Function to toggle the Blue-Merle Services On/Off at Startup/Boot/Runtime
function toggleService(service, button) {
    checkServiceState(service).then(
        function(isEnabled) {
            var command = isEnabled ? 'disable-' + service : 'enable-' + service;
            return callBlueMerle(command).then(
                function(res) {
                    console.log("Service", service, "command", command, "result", res);
                    updateServiceButton(button, service, !isEnabled);
                }
            ).catch(
                function(err) {
                    console.log("Error toggling service", service, err);
                    ui.addNotification(null, E('p', _('Error toggling %s: %s').format(service, err)));
                }
            );
        }
    );
}

function updateServiceButton(button, service, isEnabled) {
    var indicator = button.querySelector('.bm-status-indicator');
    var text = button.querySelector('.bm-button-text');
    
    if (indicator) {
        indicator.className = 'bm-status-indicator ' + (isEnabled ? 'enabled' : 'disabled');
    }
    if (text) {
        text.textContent = (isEnabled ? 'Disable' : 'Enable') + ' ' + service.charAt(0).toUpperCase() + service.slice(1);
    }
}

function createServiceButton(service, displayName) {
    var button = E('button', { 
        'class': 'btn cbi-button',
        'click': function() { toggleService(service, this); },
        'disabled': isReadonlyView 
    }, [
        E('span', { 'class': 'bm-status-indicator' }),
        E('span', { 'class': 'bm-button-text' }, _('Enable ') + displayName)
    ]);
    
    checkServiceState(service).then(function(state) {
        updateServiceButton(button, service, state);
    });
    
    return button;
}

// Helper to read config
function readConfig() {
    return fs.read(CONFIG_PATH).then(
        function(res) {
            try {
                return JSON.parse(res);
            } catch (e) {
                return {};
            }
        },
        function() { return {}; }
    );
}

// Helper to write config
function writeConfig(cfg) {
    return fs.write(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}

// Global variables for IMEI config
var currentImeiMode = 'random';
var currentStaticImei = '';

function handleImeiModeChange(ev) {
    currentImeiMode = ev.target.value;
    var staticInput = document.getElementById('static-imei-input');
    var warningDiv = document.getElementById('static-imei-warning');
    
    if (staticInput) {
        staticInput.style.display = currentImeiMode === 'static' ? 'block' : 'none';
    }
    if (warningDiv) {
        warningDiv.style.display = currentImeiMode === 'static' ? 'block' : 'none';
    }
}

function handleStaticImeiChange(ev) {
    currentStaticImei = ev.target.value;
    // Basic validation
    var isValid = /^[0-9]{15}$/.test(currentStaticImei);
    var saveButton = document.getElementById('save-config-button');
    if (saveButton) {
        saveButton.disabled = currentImeiMode === 'static' && !isValid;
    }
}

function handleSaveImeiConfig(ev) {
    var config = {
        imei_mode: currentImeiMode,
        timestamp: new Date().toISOString()
    };
    
    if (currentImeiMode === 'static') {
        if (!/^[0-9]{15}$/.test(currentStaticImei)) {
            ui.addNotification(null, E('p', _('Error: Static IMEI must be exactly 15 digits')));
            return;
        }
        config.static_imei = currentStaticImei;
    }
    
    writeConfig(config).then(function() {
        ui.addNotification(null, E('p', _('IMEI configuration saved successfully!')));
    }).catch(function(err) {
        ui.addNotification(null, E('p', _('Error saving IMEI configuration: ') + err));
    });
}

function handleGenerateRandomImei(ev) {
    var button = ev.target;
    button.disabled = true;
    button.textContent = _('Generating...');
    
    randomIMEI();
    
    setTimeout(function() {
        button.disabled = false;
        button.textContent = _('Generate New IMEI');
    }, 2000);
}

return view.extend({
    load: function() {
        return Promise.resolve();
    },

    render: function(listData) {
        var query = decodeURIComponent(L.toArray(location.search.match(/\bquery=([^=]+)\b/))[1] || '');

        var view = E([], [
            E('style', { 'type': 'text/css' }, [ css ]),

            E('h2', {}, _('Blue Merle - Identity Randomization')),

            // Current Status Section
            E('div', { 'class': 'bm-section' }, [
                E('h3', {}, _('Current Device Identity')),
                E('div', { 'class': 'bm-main-controls' }, [
                    E('div', { 'class': 'bm-control-group' }, [
                        E('label', {}, _('IMEI (International Mobile Equipment Identity)')),
                        E('input', { 
                            'id': 'imei-input', 
                            'type': 'text', 
                            'placeholder': _('Loading...'), 
                            'disabled': true 
                        }),
                        E('div', { 'class': 'bm-info-text' }, 
                            _('Unique identifier for your cellular modem')
                        )
                    ]),
                    E('div', { 'class': 'bm-control-group' }, [
                        E('label', {}, _('IMSI (International Mobile Subscriber Identity)')),
                        E('input', { 
                            'id': 'imsi-input', 
                            'type': 'text', 
                            'placeholder': _('Loading...'), 
                            'disabled': true 
                        }),
                        E('div', { 'class': 'bm-info-text' }, 
                            _('Unique identifier stored on your SIM card')
                        )
                    ])
                ])
            ]),

            // Primary Action Section
            E('div', { 'class': 'bm-section' }, [
                E('h3', {}, _('Primary Actions')),
                E('div', { 'class': 'bm-button-group primary' }, [
                    E('label', {}, _('SIM Swap:')),
                    E('button', { 
                        'class': 'btn cbi-button-action', 
                        'click': handleSimSwap, 
                        'disabled': isReadonlyView 
                    }, [ _('Initiate SIM Swap Process') ]),
                    E('div', { 'class': 'bm-info-text' }, 
                        _('Safely prepare device for SIM card replacement with new identity')
                    )
                ]),
                E('div', { 'class': 'bm-button-group' }, [
                    E('label', {}, _('Quick IMEI:')),
                    E('button', { 
                        'class': 'btn cbi-button-positive', 
                        'click': handleGenerateRandomImei, 
                        'disabled': isReadonlyView 
                    }, [ _('Generate New IMEI') ]),
                    E('div', { 'class': 'bm-info-text' }, 
                        _('Generate and apply a new random IMEI immediately')
                    )
                ])
            ]),

            // IMEI Configuration Section
            E('div', { 'class': 'bm-section' }, [
                E('h3', {}, _('IMEI Generation Configuration')),
                
                E('div', { 'class': 'bm-form-group' }, [
                    E('label', {}, _('Generation Mode:')),
                    E('select', { 
                        'id': 'imei-mode-select',
                        'change': handleImeiModeChange
                    }, [
                        E('option', { 'value': 'random' }, _('Random - Generate completely random IMEI')),
                        E('option', { 'value': 'deterministic' }, _('Deterministic - Derive from IMSI hash')),
                        E('option', { 'value': 'static' }, _('Static - Use manually specified IMEI'))
                    ])
                ]),
                
                E('div', { 'class': 'bm-form-group' }, [
                    E('label', {}, _('Static IMEI:')),
                    E('input', { 
                        'id': 'static-imei-input',
                        'type': 'text', 
                        'placeholder': _('Enter 15-digit IMEI (e.g. 353232102084953)'), 
                        'maxlength': 15,
                        'pattern': '[0-9]{15}',
                        'style': 'display: none;',
                        'input': handleStaticImeiChange
                    })
                ]),
                
                E('div', { 'id': 'static-imei-warning', 'class': 'bm-warning', 'style': 'display: none;' },
                    _('Warning: Using the same static IMEI repeatedly may compromise your privacy and security.')
                ),
                
                E('div', { 'class': 'bm-button-group' }, [
                    E('button', { 
                        'id': 'save-config-button',
                        'class': 'btn cbi-button-positive',
                        'click': handleSaveImeiConfig,
                        'disabled': isReadonlyView
                    }, [ _('Save Configuration') ])
                ])
            ]),

            // Randomization Services Section
            E('div', { 'class': 'bm-section' }, [
                E('h3', {}, _('Additional Privacy Features')),
                E('div', { 'class': 'bm-button-group' }, [
                    E('label', {}, _('Network Randomization:')),
                    E('div', { 'class': 'bm-randomization-grid' }, [
                        createServiceButton('hostname', 'Hostname'),
                        createServiceButton('bssid', 'BSSID/MAC'),
                        createServiceButton('ssid', 'SSID'),
                        createServiceButton('password', 'WiFi Password')
                    ])
                ]),
                E('div', { 'class': 'bm-info-text' }, 
                    _('These services randomize various network identifiers on startup to enhance privacy')
                )
            ])
        ]);

        // Load current values after DOM is ready
        setTimeout(function() {
            // Load IMEI
            readIMEI().then(function(imei) {
                var input = document.getElementById('imei-input');
                if (input) {
                    input.value = imei.trim();
                    input.placeholder = _('IMEI loaded');
                }
            }).catch(function(err) {
                console.log("Error reading IMEI:", err);
                var input = document.getElementById('imei-input');
                if (input) {
                    input.value = "";
                    input.placeholder = _('Error reading IMEI');
                }
            });

            // Load IMSI
            readIMSI().then(function(imsi) {
                var input = document.getElementById('imsi-input');
                if (input) {
                    input.value = imsi.trim();
                    input.placeholder = _('IMSI loaded');
                }
            }).catch(function(err) {
                console.log("Error reading IMSI:", err);
                var input = document.getElementById('imsi-input');
                if (input) {
                    input.value = "";
                    input.placeholder = _('No IMSI found');
                }
            });

            // Load saved config
            readConfig().then(function(config) {
                currentImeiMode = config.imei_mode || 'random';
                currentStaticImei = config.static_imei || '';
                
                var select = document.getElementById('imei-mode-select');
                if (select) select.value = currentImeiMode;
                
                var staticInput = document.getElementById('static-imei-input');
                var warningDiv = document.getElementById('static-imei-warning');
                if (staticInput) {
                    staticInput.value = currentStaticImei;
                    staticInput.style.display = currentImeiMode === 'static' ? 'block' : 'none';
                }
                if (warningDiv) {
                    warningDiv.style.display = currentImeiMode === 'static' ? 'block' : 'none';
                }
            }).catch(function(err) {
                console.log("Could not load config:", err);
            });
        }, 100);

        return view;
    },

    handleSave: null,
    handleSaveApply: null,
    handleReset: null
});