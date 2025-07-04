// Blue-Merle Component for GL-iNet SDK4 UI Framework
// Adapted from your existing blue-merle.js

'use strict';

// Component definition compatible with GL-iNet SDK4
const BlueMerleComponent = {
    name: 'BlueMerle',
    template: `
        <div id="blue-merle-wrapper">
            <div class="page-header">
                <h2>Blue Merle - Identity Randomization</h2>
            </div>
            
            <!-- Current Status Section -->
            <div class="bm-section">
                <h3>Current Device Identity</h3>
                <div class="bm-main-controls">
                    <div class="bm-control-group">
                        <label>IMEI (International Mobile Equipment Identity)</label>
                        <input 
                            id="imei-input" 
                            type="text" 
                            placeholder="Loading..." 
                            :value="currentImei"
                            disabled 
                        />
                        <div class="bm-info-text">
                            Unique identifier for your cellular modem
                        </div>
                    </div>
                    <div class="bm-control-group">
                        <label>IMSI (International Mobile Subscriber Identity)</label>
                        <input 
                            id="imsi-input" 
                            type="text" 
                            placeholder="Loading..." 
                            :value="currentImsi"
                            disabled 
                        />
                        <div class="bm-info-text">
                            Unique identifier stored on your SIM card
                        </div>
                    </div>
                </div>
            </div>

            <!-- Primary Action Section -->
            <div class="bm-section">
                <h3>Primary Actions</h3>
                <div class="bm-button-group primary">
                    <label>SIM Swap:</label>
                    <button 
                        class="btn btn-primary" 
                        @click="handleSimSwap"
                        :disabled="isProcessing"
                    >
                        Initiate SIM Swap Process
                    </button>
                    <div class="bm-info-text">
                        Safely prepare device for SIM card replacement with new identity, will generate a random IMEI
                    </div>
                </div>
            </div>

            <!-- IMEI Configuration Section -->
            <div class="bm-section">
                <h3>SIM Swap Switch: IMEI Generation Configuration</h3>
                
                <div class="bm-form-group">
                    <label>Generation Mode:</label>
                    <select 
                        v-model="imeiMode"
                        @change="handleImeiModeChange"
                        class="form-control"
                    >
                        <option value="random">Random - Generate completely random IMEI</option>
                        <option value="deterministic">Deterministic - Derive from IMSI hash</option>
                        <option value="static">Static - Use manually specified IMEI</option>
                    </select>
                </div>
                
                <div class="bm-form-group" v-show="imeiMode === 'static'">
                    <label>Static IMEI:</label>
                    <input 
                        type="text" 
                        v-model="staticImei"
                        placeholder="Enter 15-digit IMEI (e.g. 351380441332807)"
                        maxlength="15"
                        pattern="[0-9]{15}"
                        @input="handleStaticImeiChange"
                        class="form-control"
                    />
                </div>
                
                <div v-show="imeiMode === 'static'" class="bm-warning">
                    Warning: Using the same static IMEI repeatedly may compromise your privacy and security.
                </div>
                
                <div class="bm-button-group">
                    <button 
                        class="btn btn-success"
                        @click="handleSaveImeiConfig"
                        :disabled="isProcessing || (imeiMode === 'static' && !isValidStaticImei)"
                    >
                        Save Configuration
                    </button>
                </div>
            </div>

            <!-- Randomization Services Section -->
            <div class="bm-section">
                <h3>Additional Privacy Features</h3>
                <div class="bm-button-group">
                    <label>Network Randomization:</label>
                    <div class="bm-randomization-grid">
                        <button 
                            v-for="service in services"
                            :key="service.name"
                            :class="['btn', service.enabled ? 'btn-success' : 'btn-secondary']"
                            @click="toggleService(service.name)"
                            :disabled="isProcessing"
                        >
                            <span :class="['bm-status-indicator', service.enabled ? 'enabled' : 'disabled']"></span>
                            <span class="bm-button-text">
                                {{ service.enabled ? 'Disable' : 'Enable' }} {{ service.displayName }}
                            </span>
                        </button>
                    </div>
                </div>
                <div class="bm-info-text">
                    These services randomize various network identifiers on startup to enhance privacy
                </div>
            </div>

            <!-- Modal for SIM Swap Process -->
            <div v-if="showSimSwapModal" class="modal-overlay" @click="closeModal">
                <div class="modal-content" @click.stop>
                    <h3>SIM Swap Process</h3>
                    <div v-if="simSwapStep === 'shutting-down'">
                        <p class="spinning">Shutting down modem...</p>
                    </div>
                    <div v-else-if="simSwapStep === 'generating-imei'">
                        <p>Generating random IMEI...</p>
                    </div>
                    <div v-else-if="simSwapStep === 'complete'">
                        <p>New IMEI assigned: <code>{{ newImei }}</code></p>
                        <div class="bm-warning">
                            Important: Shutdown the device, swap the SIM card, then move to a different location before powering on.
                        </div>
                        <div class="modal-buttons">
                            <button class="btn btn-secondary" @click="closeModal">Cancel</button>
                            <button class="btn btn-danger" @click="handleShutdown">Shutdown Now</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `,
    
    data() {
        return {
            currentImei: '',
            currentImsi: '',
            imeiMode: 'random',
            staticImei: '',
            isProcessing: false,
            showSimSwapModal: false,
            simSwapStep: '',
            newImei: '',
            services: [
                { name: 'hostname', displayName: 'Hostname', enabled: false },
                { name: 'bssid', displayName: 'BSSID/MACADDR', enabled: false },
                { name: 'ssid', displayName: 'SSID', enabled: false },
                { name: 'password', displayName: 'Password', enabled: false }
            ]
        };
    },

    computed: {
        isValidStaticImei() {
            return /^[0-9]{15}$/.test(this.staticImei);
        }
    },

    mounted() {
        this.loadCurrentValues();
        this.loadServiceStates();
        this.loadUciConfig();
    },

    methods: {
        // API call wrapper using GL-iNet's request system
        async callBlueMerle(action) {
            try {
                const response = await this.$http.post('/cgi-bin/luci/rpc/sys', {
                    method: 'exec',
                    params: ['/usr/libexec/blue-merle', action]
                });
                
                if (response.data && response.data.result) {
                    return response.data.result;
                }
                throw new Error('Invalid response');
            } catch (error) {
                console.error('Blue Merle API call failed:', error);
                throw error;
            }
        },

        async loadCurrentValues() {
            try {
                this.currentImei = await this.callBlueMerle('read-imei');
                this.currentImsi = await this.callBlueMerle('read-imsi');
            } catch (error) {
                console.error('Failed to load current values:', error);
                this.$message.error('Failed to load device information');
            }
        },

        async loadServiceStates() {
            for (const service of this.services) {
                try {
                    const result = await this.callBlueMerle(`status-${service.name}`);
                    service.enabled = result.trim() === 'enabled';
                } catch (error) {
                    console.error(`Failed to load ${service.name} state:`, error);
                }
            }
        },

        async loadUciConfig() {
            try {
                // Load UCI configuration for IMEI settings
                const response = await this.$http.post('/cgi-bin/luci/rpc/uci', {
                    method: 'get_all',
                    params: ['blue-merle']
                });
                
                if (response.data && response.data.result && response.data.result.imei) {
                    const config = response.data.result.imei;
                    this.imeiMode = config.mode || 'random';
                    this.staticImei = config.static_value || '';
                }
            } catch (error) {
                console.log('Could not load UCI config (using defaults):', error);
            }
        },

        async handleSimSwap() {
            this.showSimSwapModal = true;
            this.simSwapStep = 'shutting-down';
            
            try {
                await this.callBlueMerle('shutdown-modem');
                this.simSwapStep = 'generating-imei';
                
                const newImei = await this.callBlueMerle('random-imei');
                this.newImei = newImei.trim();
                this.simSwapStep = 'complete';
                
                // Refresh current IMEI
                await this.loadCurrentValues();
            } catch (error) {
                console.error('SIM swap failed:', error);
                this.$message.error('SIM swap process failed: ' + error.message);
                this.closeModal();
            }
        },

        async handleShutdown() {
            try {
                await this.callBlueMerle('shutdown');
                this.$message.success('System shutdown initiated');
                this.closeModal();
            } catch (error) {
                console.error('Shutdown failed:', error);
                this.$message.error('Shutdown failed: ' + error.message);
            }
        },

        async toggleService(serviceName) {
            const service = this.services.find(s => s.name === serviceName);
            if (!service) return;

            this.isProcessing = true;
            
            try {
                const action = service.enabled ? `disable-${serviceName}` : `enable-${serviceName}`;
                await this.callBlueMerle(action);
                service.enabled = !service.enabled;
                this.$message.success(`${service.displayName} ${service.enabled ? 'enabled' : 'disabled'}`);
            } catch (error) {
                console.error(`Failed to toggle ${serviceName}:`, error);
                this.$message.error(`Failed to toggle ${service.displayName}`);
            } finally {
                this.isProcessing = false;
            }
        },

        handleImeiModeChange() {
            // Mode change logic handled by v-model
        },

        handleStaticImeiChange() {
            // Validation handled by computed property
        },

        async handleSaveImeiConfig() {
            const config = {
                imei_mode: this.imeiMode
            };
            
            if (this.imeiMode === 'static') {
                if (!this.isValidStaticImei) {
                    this.$message.error('Static IMEI must be exactly 15 digits');
                    return;
                }
                config.static_imei = this.staticImei;
            }
            
            this.isProcessing = true;
            
            try {
                // Save UCI configuration
                await this.$http.post('/cgi-bin/luci/rpc/uci', {
                    method: 'set',
                    params: ['blue-merle', 'imei', 'mode', this.imeiMode]
                });
                
                if (this.imeiMode === 'static') {
                    await this.$http.post('/cgi-bin/luci/rpc/uci', {
                        method: 'set',
                        params: ['blue-merle', 'imei', 'static_value', this.staticImei]
                    });
                }
                
                await this.$http.post('/cgi-bin/luci/rpc/uci', {
                    method: 'commit',
                    params: ['blue-merle']
                });
                
                this.$message.success('IMEI configuration saved successfully!');
            } catch (error) {
                console.error('Failed to save UCI config:', error);
                this.$message.error('Failed to save IMEI configuration');
            } finally {
                this.isProcessing = false;
            }
        },

        closeModal() {
            this.showSimSwapModal = false;
            this.simSwapStep = '';
            this.newImei = '';
        }
    }
};

// Export for GL-iNet framework
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BlueMerleComponent;
} else if (typeof window !== 'undefined') {
    window.BlueMerleComponent = BlueMerleComponent;
}