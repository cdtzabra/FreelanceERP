// FreelanceERP Application
class FreelanceERP {
    constructor() {
        this.currentPage = 'dashboard';
        this.data = {
            clients: [],
            missions: [],
            invoices: [],
            cras: [],
            company: {  // <-- AJOUT
                name: '',
                address: '',
                phone: '',
                email: '',
                siret: '',
                tva_value: '',
                nda: '',
                iban: ''
            }
        };
        this.backend = { url: '', apiKey: '' };
        this.suppressRemoteSync = false;
        this.init();
    }

    init() {
        // Prevent remote sync during initial boot until we've tried pulling remote data
        this.suppressRemoteSync = true;
        this.loadBackendConfig();
        // this.loadCompanyConfig();
        this.initializeEventListeners();
        this.showPage('dashboard');

        // Import/Export handlers
        this.$('#btn-export').onclick = () => this.onExport();
        this.$('#btn-import').onclick = () => this.$('#file-input').click();
        this.$('#file-input').onchange = e => this.onFileSelected(e);

        // Backend sync handlers
        const backendBtn = this.$('#btn-backend-config');
        const syncBtn = this.$('#btn-sync');
        if (backendBtn) backendBtn.onclick = () => this.configureBackend();
        if (syncBtn) syncBtn.onclick = () => this.syncLoadFromServer();
        const companyBtn = this.$('#btn-company');
        if (companyBtn) companyBtn.onclick = () => this.showCompanyForm();

        // CORRECTION: Auto-load from backend if configured
        if (this.backend.url && this.backend.apiKey) {
            this.syncLoadFromServer().then(() => {
                this.updateDashboard();
            }).finally(() => {
                this.suppressRemoteSync = false;
            });
        } else {
            // No backend configured - just update dashboard with empty data
            this.updateDashboard();
            this.suppressRemoteSync = false;
        }
    }
    // INIT end



    $(selector) {
        return document.querySelector(selector);
    }

    get company() {
        return this.data.company;
    }

    set company(value) {
        this.data.company = value;
    }

    onExport() {
        try {
            const exportData = {
                exportDate: new Date().toISOString(),
                version: '1.0',
                data: this.data
            };

            const jsonString = JSON.stringify(exportData, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `freelance-erp-export-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            this.showToast('Données exportées avec succès', 'success');
        } catch (error) {
            console.error('Erreur lors de l\'export:', error);
            this.showToast('Erreur lors de l\'export des données', 'error');
        }
    }

    async onFileSelected(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const fileExtension = file.name.split('.').pop().toLowerCase();
            
            if (fileExtension === 'json') {
                await this.importJSON(file);
            } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
                await this.importExcel(file);
            } else if (fileExtension === 'csv') {
                await this.importCSV(file);
            } else {
                this.showToast('Format de fichier non supporté. Utilisez JSON, Excel ou CSV', 'error');
            }
        } catch (error) {
            console.error('Erreur lors de l\'import:', error);
            this.showToast('Erreur lors de l\'import des données: ' + error.message, 'error');
        }

        event.target.value = '';
    }

    async importJSON(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const importedData = JSON.parse(e.target.result);
                    
                    if (!importedData.data) {
                        throw new Error('Structure de données invalide');
                    }

                    if (!importedData.data.cras) {
                        importedData.data.cras = [];
                    }

                    if (confirm('Voulez-vous remplacer toutes les données existantes ou les fusionner ?\n\nOK = Remplacer\nAnnuler = Fusionner')) {
                        this.data = importedData.data;
                    } else {
                        this.mergeData(importedData.data);
                    }

                    this.saveData();
                    this.updateDashboard();
                    this.showPage(this.currentPage);
                    
                    this.showToast('Données importées avec succès', 'success');
                    resolve();
                } catch (error) {
                    reject(error);
                }
            };

            reader.onerror = () => reject(new Error('Erreur de lecture du fichier'));
            reader.readAsText(file);
        });
    }

    async importExcel(file) {
        this.showToast('Import Excel: Veuillez utiliser le format JSON pour un import complet', 'info');
    }

    async importCSV(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const csvContent = e.target.result;
                    const lines = csvContent.split('\n');
                    
                    if (lines.length < 2) {
                        throw new Error('Fichier CSV vide ou invalide');
                    }

                    const clients = [];

                    for (let i = 1; i < lines.length; i++) {
                        if (!lines[i].trim()) continue;
                        
                        const values = lines[i].split(',').map(v => v.trim());
                        const client = {
                            id: Math.max(0, ...this.data.clients.map(c => c.id)) + i,
                            company: values[0] || '',
                            siren: values[1] || '',
                            address: values[2] || '',
                            contact: {
                                name: values[3] || '',
                                email: values[4] || '',
                                phone: values[5] || ''
                            },
                            billingAddress: values[2] || '',
                            createdAt: new Date().toISOString().split('T')[0]
                        };
                        
                        if (client.company && client.siren) {
                            clients.push(client);
                        }
                    }

                    if (clients.length > 0) {
                        this.data.clients.push(...clients);
                        this.saveData();
                        this.renderClients();
                        this.showToast(`${clients.length} client(s) importé(s) depuis CSV`, 'success');
                    } else {
                        throw new Error('Aucun client valide trouvé dans le CSV');
                    }

                    resolve();
                } catch (error) {
                    reject(error);
                }
            };

            reader.onerror = () => reject(new Error('Erreur de lecture du fichier'));
            reader.readAsText(file);
        });
    }

    mergeData(importedData) {
        const maxClientId = Math.max(0, ...this.data.clients.map(c => c.id));
        const maxMissionId = Math.max(0, ...this.data.missions.map(m => m.id));
        const maxInvoiceId = Math.max(0, ...this.data.invoices.map(i => i.id));
        const maxCraId = Math.max(0, ...this.data.cras.map(c => c.id));

        if (importedData.clients) {
            importedData.clients.forEach((client, index) => {
                const newClient = { ...client, id: maxClientId + index + 1 };
                this.data.clients.push(newClient);
            });
        }

        if (importedData.missions) {
            importedData.missions.forEach((mission, index) => {
                const newMission = { ...mission, id: maxMissionId + index + 1 };
                this.data.missions.push(newMission);
            });
        }

        if (importedData.invoices) {
            importedData.invoices.forEach((invoice, index) => {
                const newInvoice = { ...invoice, id: maxInvoiceId + index + 1 };
                this.data.invoices.push(newInvoice);
            });
        }

        if (importedData.cras) {
            importedData.cras.forEach((cra, index) => {
                const newCra = { ...cra, id: maxCraId + index + 1 };
                this.data.cras.push(newCra);
            });
        }
    }


    /* -------------------------
    Save Data in SQLite
    ------------------------- */
    async saveData() {
        if (!this.backend.url || !this.backend.apiKey) {
            return;
        }

        try {
            if (!this.suppressRemoteSync) {
                await this.syncSaveToServerSilent();
            }
        } catch (e) {
            console.error('Erreur de sauvegarde serveur:', e);
        }
    }

    // loadCompanyConfig() {
    //     try {
    //         const raw = localStorage.getItem('freelanceERPCompany');
    //         if (raw) {
    //             const v = JSON.parse(raw);
    //             this.company = { ...this.company, ...v };
    //         }
    //     } catch (_) { /* ignore */ }
    // }

    // saveCompanyConfig() {
    //     localStorage.setItem('freelanceERPCompany', JSON.stringify(this.company));
    //     this.renderCompanyInfo();
    //     this.renderCompanyHeader();
    //     this.renderCharts();
    // }

    loadBackendConfig() {
        try {
            const raw = localStorage.getItem('freelanceERPBackend');
            if (raw) {
                const cfg = JSON.parse(raw);
                this.backend = { url: cfg.url || '', apiKey: cfg.apiKey || '' };
            } else {
                this.backend = { url: window.location.origin, apiKey: '' };
            }
        } catch (_) {
            this.backend = { url: window.location.origin, apiKey: '' };
        }
    }

    saveBackendConfig() {
        localStorage.setItem('freelanceERPBackend', JSON.stringify(this.backend));
    }

    configureBackend() {
        const currentUrl = this.backend.url || window.location.origin;
        const url = prompt('Backend URL (ex: http://localhost:3001)', currentUrl);
        if (url === null) return;
        const trimmed = (url || '').trim();
        if (!trimmed || !/^https?:\/\//.test(trimmed)) {
            this.showToast('URL invalide', 'error');
            return;
        }
        const currentKey = this.backend.apiKey || '';
        const apiKey = prompt('API Key (x-api-key)', currentKey);
        if (apiKey === null) return;
        
        this.backend = { url: trimmed.replace(/\/$/, ''), apiKey: (apiKey || '').trim() };
        this.saveBackendConfig();
        
        // CORRECTION: Charger immédiatement les données après configuration
        if (this.backend.url && this.backend.apiKey) {
            this.syncLoadFromServer().then(() => {
                this.showToast('Configuration backend enregistrée et données chargées', 'success');
            }).catch(() => {
                this.showToast('Configuration enregistrée mais échec du chargement des données', 'warning');
            });
        } else {
            this.showToast('Configuration backend enregistrée', 'success');
        }
    }

    showCompanyForm() {
        document.getElementById('modal-title').textContent = 'Paramètres Société';
        const c = this.company || {};
        document.getElementById('modal-body').innerHTML = `
            <form id="company-form">
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label" for="comp-name">Nom</label>
                        <input type="text" id="comp-name" class="form-control" value="${c.name || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="comp-phone">Téléphone</label>
                        <input type="text" id="comp-phone" class="form-control" value="${c.phone || ''}">
                    </div>
                </div>
                <div class="form-row full-width">
                    <div class="form-group">
                        <label class="form-label" for="comp-address">Adresse</label>
                        <textarea id="comp-address" class="form-control">${c.address || ''}</textarea>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label" for="comp-email">Email</label>
                        <input type="email" id="comp-email" class="form-control" value="${c.email || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="comp-siret">SIRET</label>
                        <input type="text" id="comp-siret" class="form-control" value="${c.siret || ''}">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label" for="comp-tva">TVA (tva_value)</label>
                        <input type="text" id="comp-tva" class="form-control" value="${c.tva_value || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="comp-nda">NDA</label>
                        <input type="text" id="comp-nda" class="form-control" value="${c.nda || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="comp-iban">IBAN</label>
                        <input type="text" id="comp-iban" class="form-control" value="${c.iban || ''}">
                    </div>
                </div>
            </form>
        `;
        this.currentFormType = 'company';
        this.showModal();
    }

    async syncLoadFromServer() {
        if (!this.backend.url || !this.backend.apiKey) {
            this.showToast('Backend non configuré', 'error');
            return;
        }
        try {
            const res = await fetch(`${this.backend.url}/api/data`, {
                method: 'GET',
                headers: { 'x-api-key': this.backend.apiKey }
            });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const payload = await res.json();
            if (payload && payload.data) {
                // Ensure cras exists
                if (!payload.data.cras) payload.data.cras = [];
                this.data = payload.data;
                // CORRECTION: Mettre à jour immédiatement l'affichage
                this.updateDashboard();
                this.renderCharts();
                this.showPage(this.currentPage);
                this.showToast('Données chargées depuis le serveur', 'success');
            }
        } catch (e) {
            console.error('Erreur de chargement:', e);
            this.showToast('Échec du chargement serveur', 'error');
        }
    }

    async syncSaveToServer() {
        if (!this.backend.url || !this.backend.apiKey) {
            this.showToast('Backend non configuré', 'error');
            return;
        }
        try {
            const res = await fetch(`${this.backend.url}/api/data`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.backend.apiKey
                },
                body: JSON.stringify({ data: this.data })
            });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            this.showToast('Synchronisé avec le serveur', 'success');
        } catch (e) {
            this.showToast('Échec de synchronisation', 'error');
        }
    }

    async syncSaveToServerSilent() {
        if (!this.backend.url || !this.backend.apiKey) return;
        try {
            await fetch(`${this.backend.url}/api/data`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.backend.apiKey
                },
                body: JSON.stringify({ data: this.data })
            });
        } catch (_) { /* ignore */ }
    }

    initializeEventListeners() {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = e.currentTarget.dataset.page;
                this.showPage(page);
            });
        });

        document.getElementById('quick-action-btn').addEventListener('click', () => {
            this.handleQuickAction();
        });

        document.getElementById('add-client-btn').addEventListener('click', () => this.showClientForm());
        document.getElementById('add-mission-btn').addEventListener('click', () => this.showMissionForm());
        document.getElementById('add-invoice-btn').addEventListener('click', () => this.showInvoiceForm());
        document.getElementById('add-cra-btn').addEventListener('click', () => this.showCRAForm());

        document.getElementById('modal-close').addEventListener('click', () => this.closeModal());
        document.getElementById('modal-cancel').addEventListener('click', () => this.closeModal());
        document.getElementById('modal-save').addEventListener('click', () => this.handleModalSave());

        document.getElementById('mission-status-filter').addEventListener('change', () => this.renderMissions());
        document.getElementById('mission-client-filter').addEventListener('change', () => this.renderMissions());
        document.getElementById('invoice-status-filter').addEventListener('change', () => this.renderInvoices());
        document.getElementById('cra-month-filter').addEventListener('change', () => this.renderCRAs());


        document.getElementById('modal').addEventListener('click', (e) => {
            if (e.target.id === 'modal') {
                this.closeModal();
            }
        });
    }

    showPage(page) {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.toggle('active', link.dataset.page === page);
        });

        document.querySelectorAll('.page').forEach(pageEl => {
            pageEl.classList.toggle('active', pageEl.id === `${page}-page`);
        });

        const titles = {
            dashboard: 'Tableau de bord',
            clients: 'Clients',
            missions: 'Missions',
            cra: 'Comptes Rendus d\'Activité',
            invoices: 'Factures',
            settings: 'Paramètres'
        };
        document.getElementById('page-title').textContent = titles[page];

        this.currentPage = page;

        switch (page) {
            case 'dashboard':
                this.updateDashboard();
                break;
            case 'clients':
                this.renderClients();
                break;
            case 'missions':
                this.renderMissions();
                this.populateMissionFilters();
                break;
            case 'cra':
                this.renderCRAs();
                this.populateCRAFilters();
                break;
            case 'invoices':
                this.renderInvoices();
                break;
            case 'settings':
                this.renderSettings();
                break;
        }
    }

    handleQuickAction() {
        switch (this.currentPage) {
            case 'clients':
                this.showClientForm();
                break;
            case 'missions':
                this.showMissionForm();
                break;
            case 'cra':
                this.showCRAForm();
                break;
            case 'invoices':
                this.showInvoiceForm();
                break;
            default:
                this.showClientForm();
        }
    }

    updateDashboard() {
        const totalRevenue = this.data.invoices
            .filter(invoice => invoice.status === 'Payée')
            .reduce((sum, invoice) => sum + (invoice.amount * (1 + invoice.vatRate / 100)), 0);
        
        const pendingRevenue = this.data.invoices
            .filter(invoice => invoice.status == 'Envoyée' || invoice.status == 'En retard' )
            .reduce((sum, invoice) => sum + (invoice.amount * (1 + invoice.vatRate / 100)), 0);

        const generatedRevenue = totalRevenue + pendingRevenue;
        
        const activeMissions = this.data.missions.filter(m => m.status === 'En cours').length;
        const pendingInvoices = this.data.invoices.filter(i => i.status === 'Envoyée').length;
        const totalClients = this.data.clients.length;

        document.getElementById('total-revenue').textContent = `${totalRevenue.toLocaleString('fr-FR')} €`;
        document.getElementById('pending-revenue').textContent = `${pendingRevenue.toLocaleString('fr-FR')} €`;
        document.getElementById('generated-revenue').textContent = `${generatedRevenue.toLocaleString('fr-FR')} €`;
        document.getElementById('active-missions').textContent = activeMissions;
        document.getElementById('pending-invoices').textContent = pendingInvoices;
        document.getElementById('total-clients').textContent = totalClients;

        this.renderRecentMissions();
        this.renderPendingInvoices();
        this.renderGeneratedRevenueByMonth();
        this.renderPaidRevenueByMonth();
        this.renderCompanyInfo();
        this.renderCharts();
    }

    renderCompanyInfo() {
        const el = document.getElementById('company-card');
        if (!el) return;
        const c = this.company || {};
        
        // const hasData = c.name || c.address || c.phone || c.email || c.siret || c.tva_value || c.nda || c.iban;
        
        if (!c.name) {
            el.innerHTML = '<p style="color: var(--color-text-secondary);">Aucune information société. Cliquez sur "Société" pour configurer.</p>';
            return;
        }
    
        el.innerHTML = `
            <div class="grid">
                ${c.name ? `<div class="item"><label>Nom</label><div>${c.name}</div></div>` : ''}
                ${c.siret ? `<div class="item"><label>SIRET</label><div>${c.siret}</div></div>` : ''}
                ${c.email ? `<div class="item"><label>Email</label><div>${c.email}</div></div>` : ''}
                ${c.phone ? `<div class="item"><label>Téléphone</label><div>${c.phone}</div></div>` : ''}
                ${c.tva_value ? `<div class="item"><label>TVA</label><div>${c.tva_value}</div></div>` : ''}
                ${c.nda ? `<div class="item"><label>NDA</label><div>${c.nda}</div></div>` : ''}
                ${c.iban ? `<div class="item"><label>IBAN</label><div>${c.iban}</div></div>` : ''}
                ${c.address ? `<div class="item" style="grid-column: 1 / -1;"><label>Adresse</label><div>${c.address.replace(/\n/g, '<br>')}</div></div>` : ''}
            </div>
        `;
    }

    renderCompanyHeader() {
        //const el = document.getElementById('company-header');
        const el = document.getElementById('company-card');
        if (!el) return;
        const c = this.company || {};
        if (!c.name && !c.address && !c.iban) {
            el.innerHTML = '';
            return;
        }
        el.innerHTML = `
            <div class="company-header__content">
                <strong>${c.name || ''}</strong>
                <span>${(c.address || '').replace(/\n/g, ' · ')}</span>
                <span>${c.siret || ''}</span>
                <span>${c.tva_value || ''}</span>
                <span>${c.iban || ''}</span>
            </div>
        `;
    }

    renderCharts() {
        const genCanvas = document.getElementById('chart-generated');
        const paidCanvas = document.getElementById('chart-paid');
        const totalCanvas = document.getElementById('chart-total');
        if (!window.Chart || (!genCanvas && !paidCanvas && !totalCanvas)) return;

        // Build datasets from already computed tables
        const genMap = new Map();
        for (const cra of this.data.cras) {
            const mission = this.data.missions.find(m => m.id === cra.missionId);
            if (!mission) continue;
            const month = cra.month;
            const amountHT = (cra.daysWorked || 0) * (mission.dailyRate || 0);
            const vat = amountHT * ((mission.vatRate ?? 20) / 100);
            if (!genMap.has(month)) genMap.set(month, { ht: 0, tva: 0 });
            const v = genMap.get(month);
            v.ht += amountHT; v.tva += vat;
        }
        const paidMap = new Map();
        for (const inv of this.data.invoices) {
            if (inv.status !== 'Payée') continue;
            const dateStr = inv.paidDate || inv.date;
            if (!dateStr) continue;
            const month = dateStr.slice(0,7);
            const amountHT = inv.amount || 0;
            const vat = amountHT * ((inv.vatRate || 0) / 100);
            if (!paidMap.has(month)) paidMap.set(month, { ht: 0, tva: 0 });
            const v = paidMap.get(month);
            v.ht += amountHT; v.tva += vat;
        }

        const genLabels = [...genMap.keys()].sort();
        const genHT = genLabels.map(m => genMap.get(m).ht);
        const genTVA = genLabels.map(m => genMap.get(m).tva);

        const paidLabels = [...paidMap.keys()].sort();
        const paidHT = paidLabels.map(m => paidMap.get(m).ht);
        const paidTVA = paidLabels.map(m => paidMap.get(m).tva);

        // Total revenue by month (HT+TVA) using paid data
        const totalLabels = paidLabels;
        const totalData = totalLabels.map((m, i) => (paidHT[i] + paidTVA[i]));

        if (genCanvas) {
            if (this._genChart) this._genChart.destroy();
            this._genChart = new Chart(genCanvas, {
                type: 'bar',
                data: {
                    labels: genLabels.map(m => this.formatMonth(m)),
                    datasets: [
                        { label: 'HT', data: genHT, backgroundColor: 'rgba(52,152,219,0.6)' },
                        { label: 'TVA', data: genTVA, backgroundColor: 'rgba(243,156,18,0.6)' }
                    ]
                },
                options: { responsive: true, scales: { y: { beginAtZero: true } } }
            });
        }
        if (paidCanvas) {
            if (this._paidChart) this._paidChart.destroy();
            this._paidChart = new Chart(paidCanvas, {
                type: 'line',
                data: {
                    labels: paidLabels.map(m => this.formatMonth(m)),
                    datasets: [
                        { label: 'HT', data: paidHT, borderColor: 'rgba(46,204,113,1)', backgroundColor: 'rgba(46,204,113,0.2)', fill: true },
                        { label: 'TVA', data: paidTVA, borderColor: 'rgba(231,76,60,1)', backgroundColor: 'rgba(231,76,60,0.2)', fill: true }
                    ]
                },
                options: { responsive: true, scales: { y: { beginAtZero: true } } }
            });
        }
        if (totalCanvas) {
            if (this._totalChart) this._totalChart.destroy();
            this._totalChart = new Chart(totalCanvas, {
                type: 'line',
                data: {
                    labels: totalLabels.map(m => this.formatMonth(m)),
                    datasets: [
                        { label: 'Total TTC encaissé', data: totalData, borderColor: 'rgba(52,73,94,1)', backgroundColor: 'rgba(52,73,94,0.15)', fill: true }
                    ]
                },
                options: { responsive: true, scales: { y: { beginAtZero: true } } }
            });
        }
    }

    renderGeneratedRevenueByMonth() {
        const body = document.getElementById('generated-revenue-body');
        if (!body) return;
        // Aggregate by CRA month
        const map = new Map(); // month -> { days, amountHT, vat, total }
        for (const cra of this.data.cras) {
            const mission = this.data.missions.find(m => m.id === cra.missionId);
            if (!mission) continue;
            const month = cra.month; // YYYY-MM
            const amountHT = (cra.daysWorked || 0) * (mission.dailyRate || 0);
            const vat = amountHT * ((mission.vatRate ?? 20) / 100);
            const total = amountHT + vat;
            if (!map.has(month)) map.set(month, { days: 0, amountHT: 0, vat: 0, total: 0 });
            const agg = map.get(month);
            agg.days += cra.daysWorked || 0;
            agg.amountHT += amountHT;
            agg.vat += vat;
            agg.total += total;
        }
        const rows = [...map.entries()].sort((a,b) => a[0] < b[0] ? 1 : -1).map(([month, v]) => {
            return `
                <tr>
                    <td>${this.formatMonth(month)}</td>
                    <td>${v.days}</td>
                    <td>${v.amountHT.toLocaleString('fr-FR')} €</td>
                    <td>${v.vat.toLocaleString('fr-FR')} €</td>
                    <td>${v.total.toLocaleString('fr-FR')} €</td>
                </tr>
            `;
        });
        body.innerHTML = rows.join('') || '<tr><td colspan="5" style="text-align:center;">Aucune donnée</td></tr>';
    }

    renderPaidRevenueByMonth() {
        const body = document.getElementById('paid-revenue-body');
        if (!body) return;
        const map = new Map(); // YYYY-MM -> { amountHT, vat, total }
        for (const inv of this.data.invoices) {
            if (inv.status !== 'Payée') continue;
            const dateStr = inv.paidDate || inv.date; // fallback if missing
            if (!dateStr) continue;
            const ym = dateStr.slice(0,7);
            const amountHT = inv.amount || 0;
            const vat = amountHT * ((inv.vatRate || 0) / 100);
            const total = amountHT + vat;
            if (!map.has(ym)) map.set(ym, { amountHT: 0, vat: 0, total: 0 });
            const agg = map.get(ym);
            agg.amountHT += amountHT;
            agg.vat += vat;
            agg.total += total;
        }
        const rows = [...map.entries()].sort((a,b) => a[0] < b[0] ? 1 : -1).map(([month, v]) => {
            return `
                <tr>
                    <td>${this.formatMonth(month)}</td>
                    <td>${v.amountHT.toLocaleString('fr-FR')} €</td>
                    <td>${v.vat.toLocaleString('fr-FR')} €</td>
                    <td>${v.total.toLocaleString('fr-FR')} €</td>
                </tr>
            `;
        });
        body.innerHTML = rows.join('') || '<tr><td colspan="4" style="text-align:center;">Aucune donnée</td></tr>';
    }

    renderRecentMissions() {
        const container = document.getElementById('recent-missions');
        const recentMissions = this.data.missions
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 5);

        container.innerHTML = recentMissions.map(mission => {
            const client = this.data.clients.find(c => c.id === mission.clientId);
            return `
                <div class="mission-item">
                    <h4>${mission.title}</h4>
                    <p>Client: ${client ? client.company : 'N/A'}</p>
                    <div class="mission-meta">
                        <span class="status-badge status-badge--${this.getStatusClass(mission.status)}">${mission.status}</span>
                        <span>${mission.dailyRate}€/jour</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderPendingInvoices() {
        const container = document.getElementById('pending-invoices-list');
        const pendingInvoices = this.data.invoices.filter(i => i.status === 'Envoyée' || i.status === 'En retard');

        container.innerHTML = pendingInvoices.map(invoice => {
            const client = this.data.clients.find(c => c.id === invoice.clientId);
            const totalAmount = invoice.amount * (1 + invoice.vatRate / 100);
            return `
                <div class="invoice-item">
                    <h4>${invoice.number}</h4>
                    <p>Client: ${client ? client.company : 'N/A'}</p>
                    <div class="invoice-meta">
                        <span class="status-badge status-badge--sent">${invoice.status}</span>
                        <span>${totalAmount.toLocaleString('fr-FR')} €</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderClients() {
        const tbody = document.getElementById('clients-table-body');
        tbody.innerHTML = this.data.clients.map(client => `
            <tr>
                <td>${client.company}</td>
                <td>${client.siren}</td>
                <td>${client.contact.name}</td>
                <td>${client.contact.email}</td>
                <td>${client.billingEmail || ''}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-icon btn-icon--edit" onclick="app.editClient(${client.id})" title="Modifier">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon btn-icon--delete" onclick="app.deleteClient(${client.id})" title="Supprimer">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    showClientForm(client = null) {
        const isEdit = !!client;
        const title = isEdit ? 'Modifier le client' : 'Nouveau client';
        
        document.getElementById('modal-title').textContent = title;
        document.getElementById('modal-body').innerHTML = `
            <form id="client-form">
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label" for="company">Société *</label>
                        <input type="text" id="company" class="form-control" value="${client ? client.company : ''}" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="siren">SIREN *</label>
                        <input type="text" id="siren" class="form-control" value="${client ? client.siren : ''}" required pattern="[0-9]{9}">
                    </div>
                </div>
                <div class="form-row full-width">
                    <div class="form-group">
                        <label class="form-label" for="address">Adresse *</label>
                        <textarea id="address" class="form-control" required>${client ? client.address : ''}</textarea>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label" for="contact-name">Nom du contact *</label>
                        <input type="text" id="contact-name" class="form-control" value="${client ? client.contact.name : ''}" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="contact-email">Email *</label>
                        <input type="email" id="contact-email" class="form-control" value="${client ? client.contact.email : ''}" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="billing-email">Email de facturation</label>
                        <input type="email" id="billing-email" class="form-control" value="${client ? (client.billingEmail || '') : ''}">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label" for="contact-phone">Téléphone</label>
                        <input type="tel" id="contact-phone" class="form-control" value="${client ? client.contact.phone : ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="client-notes">Notes</label>
                        <textarea id="client-notes" class="form-control">${client ? (client.notes || '') : ''}</textarea>
                    </div>
                </div>
                <div class="checkbox-group">
                    <input type="checkbox" id="same-billing-address" ${client && client.billingAddress === client.address ? 'checked' : ''}>
                    <label for="same-billing-address">Adresse de facturation identique</label>
                </div>
                <div class="form-row full-width">
                    <div class="form-group">
                        <label class="form-label" for="billing-address">Adresse de facturation</label>
                        <textarea id="billing-address" class="form-control">${client ? client.billingAddress : ''}</textarea>
                    </div>
                </div>
            </form>
        `;

        document.getElementById('same-billing-address').addEventListener('change', (e) => {
            const billingAddressField = document.getElementById('billing-address');
            if (e.target.checked) {
                billingAddressField.value = document.getElementById('address').value;
                billingAddressField.disabled = true;
            } else {
                billingAddressField.disabled = false;
            }
        });

        document.getElementById('address').addEventListener('input', () => {
            if (document.getElementById('same-billing-address').checked) {
                document.getElementById('billing-address').value = document.getElementById('address').value;
            }
        });

        this.currentFormType = 'client';
        this.currentEditItem = client;
        this.showModal();
    }

    editClient(id) {
        const client = this.data.clients.find(c => c.id === id);
        this.showClientForm(client);
    }

    deleteClient(id) {
        if (confirm('Êtes-vous sûr de vouloir supprimer ce client ?')) {
            this.data.clients = this.data.clients.filter(c => c.id !== id);
            this.saveData();
            this.renderClients();
            this.showToast('Client supprimé avec succès', 'success');
        }
    }

    renderMissions() {
        const statusFilter = document.getElementById('mission-status-filter').value;
        const clientFilter = document.getElementById('mission-client-filter').value;
        
        let filteredMissions = this.data.missions;
        
        if (statusFilter) {
            filteredMissions = filteredMissions.filter(m => m.status === statusFilter);
        }
        
        if (clientFilter) {
            filteredMissions = filteredMissions.filter(m => m.clientId === parseInt(clientFilter));
        }

        const tbody = document.getElementById('missions-table-body');
        tbody.innerHTML = filteredMissions.map(mission => {
            const client = this.data.clients.find(c => c.id === mission.clientId);
            const startDate = new Date(mission.startDate).toLocaleDateString('fr-FR');
            const endDate = new Date(mission.endDate).toLocaleDateString('fr-FR');
            
            const descriptionHtml = (mission.description || '').replace(/\n/g, '<br>');
            return `
                <tr>
                    <td>${mission.title}</td>
                    <td>${descriptionHtml}</td>
                    <td>${client ? client.company : 'N/A'}</td>
                    <td>${startDate} - ${endDate}</td>
                    <td>${mission.dailyRate}€</td>
                    <td><span class="status-badge status-badge--${this.getStatusClass(mission.status)}">${mission.status}</span></td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn-icon btn-icon--edit" onclick="app.editMission(${mission.id})" title="Modifier">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn-icon btn-icon--delete" onclick="app.deleteMission(${mission.id})" title="Supprimer">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    populateMissionFilters() {
        const clientFilter = document.getElementById('mission-client-filter');
        clientFilter.innerHTML = '<option value="">Tous les clients</option>' +
            this.data.clients.map(client => 
                `<option value="${client.id}">${client.company}</option>`
            ).join('');
    }

    showMissionForm(mission = null) {
        const isEdit = !!mission;
        const title = isEdit ? 'Modifier la mission' : 'Nouvelle mission';
        
        document.getElementById('modal-title').textContent = title;
        document.getElementById('modal-body').innerHTML = `
            <form id="mission-form">
                <div class="form-row full-width">
                    <div class="form-group">
                        <label class="form-label" for="mission-title">Titre *</label>
                        <input type="text" id="mission-title" class="form-control" value="${mission ? mission.title : ''}" required>
                    </div>
                </div>
                <div class="form-row full-width">
                    <div class="form-group">
                        <label class="form-label" for="mission-description">Description</label>
                        <textarea id="mission-description" class="form-control">${mission ? mission.description : ''}</textarea>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label" for="mission-client">Client *</label>
                        <select id="mission-client" class="form-control" required>
                            <option value="">Sélectionner un client</option>
                            ${this.data.clients.map(client => 
                                `<option value="${client.id}" ${mission && mission.clientId === client.id ? 'selected' : ''}>${client.company}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="mission-status">Statut</label>
                        <select id="mission-status" class="form-control">
                            <option value="En attente" ${mission && mission.status === 'En attente' ? 'selected' : ''}>En attente</option>
                            <option value="En cours" ${mission && mission.status === 'En cours' ? 'selected' : ''}>En cours</option>
                            <option value="Terminée" ${mission && mission.status === 'Terminée' ? 'selected' : ''}>Terminée</option>
                            <option value="Facturée" ${mission && mission.status === 'Facturée' ? 'selected' : ''}>Facturée</option>
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label" for="start-date">Date de début *</label>
                        <input type="date" id="start-date" class="form-control" value="${mission ? mission.startDate : ''}" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="end-date">Date de fin *</label>
                        <input type="date" id="end-date" class="form-control" value="${mission ? mission.endDate : ''}" required>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label" for="daily-rate">TJM (€) *</label>
                        <input type="number" id="daily-rate" class="form-control" value="${mission ? mission.dailyRate : ''}" min="0" step="0.01" required>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label" for="vatRate">TVA (%)</label>
                        <input type="number" id="vatRate" class="form-control" min="0" step="0.1"
                            value="${mission ? mission.vatRate ?? 20 : 20}">
                    </div>
                </div>

            </form>
        `;

        this.currentFormType = 'mission';
        this.currentEditItem = mission;
        this.showModal();
    }

    editMission(id) {
        const mission = this.data.missions.find(m => m.id === id);
        this.showMissionForm(mission);
    }

    deleteMission(id) {
        if (confirm('Êtes-vous sûr de vouloir supprimer cette mission ?')) {
            this.data.missions = this.data.missions.filter(m => m.id !== id);
            this.saveData();
            this.renderMissions();
            this.showToast('Mission supprimée avec succès', 'success');
        }
    }

    generateInvoiceFromMission(missionId) {
        const mission = this.data.missions.find(m => m.id === missionId);
        if (!mission) return;

        const startDate = new Date(mission.startDate);
        const endDate = new Date(mission.endDate);
        const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
        const amount = days * mission.dailyRate;

        this.showInvoiceForm(null, mission, amount);
    }

    renderCRAs() {
        const monthFilter = document.getElementById('cra-month-filter').value;
        
        let filteredCRAs = this.data.cras;
        
        if (monthFilter) {
            filteredCRAs = filteredCRAs.filter(cra => cra.month === monthFilter);
        }

        const crasByMonth = {};
        filteredCRAs.forEach(cra => {
            if (!crasByMonth[cra.month]) {
                crasByMonth[cra.month] = [];
            }
            crasByMonth[cra.month].push(cra);
        });

        const tbody = document.getElementById('cra-table-body');
        let html = '';

        Object.keys(crasByMonth).sort().reverse().forEach(month => {
            const monthCRAs = crasByMonth[month];
            const monthData = monthCRAs[0];
            const totalDays = monthCRAs.reduce((sum, cra) => sum + cra.daysWorked, 0);
            const workingDays = monthData.workingDaysInMonth || 22;
            const activityRate = ((totalDays / workingDays) * 100).toFixed(1);

            html += `
                <tr class="month-header">
                    <td colspan="5">
                        <strong>${this.formatMonth(month)}</strong> - 
                        ${totalDays} jours travaillés / ${workingDays} jours ouvrés 
                        (Taux d'activité: ${activityRate}%)
                    </td>
                </tr>
            `;

            monthCRAs.forEach(cra => {
                const mission = this.data.missions.find(m => m.id === cra.missionId);
                const client = mission ? this.data.clients.find(c => c.id === mission.clientId) : null;

                const amount = cra.daysWorked * (mission ? mission.dailyRate : 0);
                
                html += `
                    <tr>
                        <td>${mission ? mission.title : 'N/A'}</td>
                        <td>${client ? client.company : 'N/A'}</td>
                        <td>${cra.daysWorked}</td>
                        <td>${amount.toLocaleString('fr-FR')} €</td>
                        <td>
                            <div class="action-buttons">
                                <button class="btn-icon btn-icon--edit" onclick="app.editCRA(${cra.id})" title="Modifier">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn-icon" onclick="app.generateInvoiceFromCRA(${cra.id})" title="Générer facture">
                                    <i class="fas fa-file-invoice"></i>
                                </button>
                                <button class="btn-icon btn-icon--delete" onclick="app.deleteCRA(${cra.id})" title="Supprimer">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            });
        });

        tbody.innerHTML = html || '<tr><td colspan="5" style="text-align: center;">Aucun CRA enregistré</td></tr>';
    }

    populateCRAFilters() {
        const monthFilter = document.getElementById('cra-month-filter');
        const months = [...new Set(this.data.cras.map(cra => cra.month))].sort().reverse();
        
        monthFilter.innerHTML = '<option value="">Tous les mois</option>' +
            months.map(month => `<option value="${month}">${this.formatMonth(month)}</option>`).join('');
    }

    showCRAForm(cra = null) {
        const isEdit = !!cra;
        const title = isEdit ? 'Modifier le CRA' : 'Nouveau CRA';
        
        document.getElementById('modal-title').textContent = title;
        document.getElementById('modal-body').innerHTML = `
            <form id="cra-form">
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label" for="cra-month">Mois *</label>
                        <input type="month" id="cra-month" class="form-control" value="${cra ? cra.month : ''}" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="working-days">Jours ouvrés dans le mois *</label>
                        <input type="number" id="working-days" class="form-control" value="${cra ? cra.workingDaysInMonth : 22}" min="1" max="31" required>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label" for="cra-mission">Mission *</label>
                        <select id="cra-mission" class="form-control" required>
                            <option value="">Sélectionner une mission</option>
                            ${this.data.missions.map(mission => 
                                `<option value="${mission.id}" ${cra && cra.missionId === mission.id ? 'selected' : ''}>${mission.title}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="days-worked">Jours travaillés *</label>
                        <input type="number" id="days-worked" class="form-control" value="${cra ? cra.daysWorked : ''}" min="0" step="0.5" required>
                    </div>
                </div>
                <div class="form-row full-width">
                    <div class="form-group">
                        <label class="form-label" for="cra-notes">Notes</label>
                        <textarea id="cra-notes" class="form-control">${cra ? cra.notes || '' : ''}</textarea>
                    </div>
                </div>
            </form>
        `;

        this.currentFormType = 'cra';
        this.currentEditItem = cra;
        this.showModal();
    }

    editCRA(id) {
        const cra = this.data.cras.find(c => c.id === id);
        this.showCRAForm(cra);
    }

    deleteCRA(id) {
        if (confirm('Êtes-vous sûr de vouloir supprimer ce CRA ?')) {
            this.data.cras = this.data.cras.filter(c => c.id !== id);
            this.saveData();
            this.renderCRAs();
            this.showToast('CRA supprimé avec succès', 'success');
        }
    }

    generateInvoiceFromCRA(craId) {
        const cra = this.data.cras.find(c => c.id === craId);
        if (!cra) return;

        const mission = this.data.missions.find(m => m.id === cra.missionId);
        if (!mission) {
            this.showToast('Mission introuvable pour ce CRA', 'error');
            return;
        }

        const amount = cra.daysWorked * mission.dailyRate;
        
        // Créer une facture avec les données du CRA
        this.showInvoiceForm(null, mission, amount, cra);
    }

    saveCRA() {
        const formData = {
            month: document.getElementById('cra-month').value,
            workingDaysInMonth: parseInt(document.getElementById('working-days').value),
            missionId: parseInt(document.getElementById('cra-mission').value),
            daysWorked: parseFloat(document.getElementById('days-worked').value),
            notes: document.getElementById('cra-notes').value
        };

        if (formData.daysWorked > formData.workingDaysInMonth) {
            this.showToast('Le nombre de jours travaillés ne peut pas dépasser le nombre de jours ouvrés', 'error');
            return;
        }

        if (this.currentEditItem) {
            const index = this.data.cras.findIndex(c => c.id === this.currentEditItem.id);
            this.data.cras[index] = { ...this.currentEditItem, ...formData };
            this.showToast('CRA modifié avec succès', 'success');
        } else {
            const newCRA = {
                id: Math.max(0, ...this.data.cras.map(c => c.id)) + 1,
                ...formData,
                createdAt: new Date().toISOString().split('T')[0]
            };
            this.data.cras.push(newCRA);
            this.showToast('CRA ajouté avec succès', 'success');
        }

        this.saveData();
        this.renderCRAs();
        this.populateCRAFilters();
        this.closeModal();
    }

    formatMonth(monthStr) {
        const [year, month] = monthStr.split('-');
        const months = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 
                       'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
        return `${months[parseInt(month) - 1]} ${year}`;
    }


    renderSettings() {
        const backendUrlEl = document.getElementById('backend-url');
        const backendKeyEl = document.getElementById('backend-key');
        if (backendUrlEl) backendUrlEl.textContent = this.backend.url || 'Non configuré';
        if (backendKeyEl) backendKeyEl.textContent = this.backend.apiKey || 'Non défini';
    
        const company = this.company || {};
        const el = document.getElementById('company-summary');
        if (el) {
            el.innerHTML = company.name
                ? `<p><strong>${company.name}</strong><br>${company.address || ''}<br>${company.email || ''}</p>`
                : '<p style="color:var(--color-text-secondary);">Aucune information société configurée.</p>';
        }
    }
    

    renderInvoices() {
        const statusFilter = document.getElementById('invoice-status-filter').value;
        let filteredInvoices = this.data.invoices;
        
        if (statusFilter) {
            filteredInvoices = filteredInvoices.filter(i => i.status === statusFilter);
        }

        const tbody = document.getElementById('invoices-table-body');
        tbody.innerHTML = filteredInvoices.map(invoice => {
            const client = this.data.clients.find(c => c.id === invoice.clientId);
            const mission = this.data.missions.find(m => m.id === invoice.missionId);
            const totalAmount = invoice.amount * (1 + invoice.vatRate / 100);
            
            return `
                <tr>
                    <td>${invoice.number}</td>
                    <td>${new Date(invoice.date).toLocaleDateString('fr-FR')}</td>
                    <td>${client ? client.company : 'N/A'}</td>
                    <td>${mission ? mission.title : 'N/A'}</td>
                    <td>${totalAmount.toLocaleString('fr-FR')} €</td>
                    <td><span class="status-badge status-badge--${this.getInvoiceStatusClass(invoice.status)}">${invoice.status}</span></td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn-icon btn-icon--edit" onclick="app.editInvoice(${invoice.id})" title="Modifier">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn-icon" onclick="app.printInvoice(${invoice.id})" title="Imprimer">
                                <i class="fas fa-print"></i>
                            </button>
                            <button class="btn-icon btn-icon--delete" onclick="app.deleteInvoice(${invoice.id})" title="Supprimer">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    showInvoiceForm(invoice = null, mission = null, amount = 0, cra = null) {
        const isEdit = !!invoice;
        const title = isEdit ? 'Modifier la facture' : 'Nouvelle facture';
        
        // Si on a un CRA, on utilise son mois pour la date de facture
        let invoiceDate = new Date().toISOString().split('T')[0];
        if (cra && cra.month) {
            // Utiliser le dernier jour du mois du CRA
            const [year, month] = cra.month.split('-');
            const lastDay = new Date(year, month, 0).getDate();
            invoiceDate = `${year}-${month}-${lastDay}`;
        }
        
        document.getElementById('modal-title').textContent = title;
        document.getElementById('modal-body').innerHTML = `
            <form id="invoice-form">
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label" for="invoice-number">Numéro</label>
                        <input type="text" id="invoice-number" class="form-control" value="${invoice ? invoice.number : this.generateInvoiceNumber()}" readonly>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="invoice-date">Date *</label>
                        <input type="date" id="invoice-date" class="form-control" value="${invoice ? invoice.date : invoiceDate}" required>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label" for="invoice-client">Client *</label>
                        <select id="invoice-client" class="form-control" required ${mission ? 'disabled' : ''}>
                            <option value="">Sélectionner un client</option>
                            ${this.data.clients.map(client => 
                                `<option value="${client.id}" ${(invoice && invoice.clientId === client.id) || (mission && mission.clientId === client.id) ? 'selected' : ''}>${client.company}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="invoice-mission">Mission *</label>
                        <select id="invoice-mission" class="form-control" required ${mission ? 'disabled' : ''}>
                            <option value="">Sélectionner une mission</option>
                            ${this.data.missions.map(m => 
                                `<option value="${m.id}" ${(invoice && invoice.missionId === m.id) || (mission && mission.id === m.id) ? 'selected' : ''}>${m.title}</option>`
                            ).join('')}
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label" for="invoice-amount">Montant HT (€) *</label>
                        <input type="number" id="invoice-amount" class="form-control" value="${invoice ? invoice.amount : amount}" min="0" step="0.01" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="invoice-vat">TVA (%) *</label>
                        <input type="number" id="invoice-vat" class="form-control" value="${invoice ? invoice.vatRate : 20}" min="0" max="100" step="0.01" required>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label" for="invoice-status">Statut</label>
                        <select id="invoice-status" class="form-control">
                            <option value="Brouillon" ${invoice && invoice.status === 'Brouillon' ? 'selected' : ''}>Brouillon</option>
                            <option value="Envoyée" ${invoice && invoice.status === 'Envoyée' ? 'selected' : ''}>Envoyée</option>
                            <option value="Payée" ${invoice && invoice.status === 'Payée' ? 'selected' : ''}>Payée</option>
                            <option value="En retard" ${invoice && invoice.status === 'En retard' ? 'selected' : ''}>En retard</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="invoice-due-date">Date d'échéance</label>
                        <input type="date" id="invoice-due-date" class="form-control" value="${invoice ? invoice.dueDate : ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="invoice-paid-date">Date de paiement</label>
                        <input type="date" id="invoice-paid-date" class="form-control" value="${invoice && invoice.paidDate ? invoice.paidDate : ''}" ${invoice && invoice.status === 'Payée' ? '' : 'disabled'}>
                    </div>
                </div>
                ${cra ? `<p class="info-text">💡 Facture générée depuis le CRA de ${this.formatMonth(cra.month)} (${cra.daysWorked} jours travaillés)</p>` : ''}
            </form>
        `;

        document.getElementById('invoice-client').addEventListener('change', (e) => {
            const clientId = parseInt(e.target.value);
            const missionSelect = document.getElementById('invoice-mission');
            const clientMissions = this.data.missions.filter(m => m.clientId === clientId);
            
            missionSelect.innerHTML = '<option value="">Sélectionner une mission</option>' +
                clientMissions.map(m => `<option value="${m.id}">${m.title}</option>`).join('');
        });

        const statusSelect = document.getElementById('invoice-status');
        const paidDateInput = document.getElementById('invoice-paid-date');
        statusSelect.addEventListener('change', () => {
            const isPaid = statusSelect.value === 'Payée';
            paidDateInput.disabled = !isPaid;
            if (isPaid && !paidDateInput.value) {
                paidDateInput.value = new Date().toISOString().split('T')[0];
            }
            if (!isPaid) {
                paidDateInput.value = '';
            }
        });

        this.currentFormType = 'invoice';
        this.currentEditItem = invoice;
        this.showModal();
    }

    editInvoice(id) {
        const invoice = this.data.invoices.find(i => i.id === id);
        this.showInvoiceForm(invoice);
    }

    deleteInvoice(id) {
        if (confirm('Êtes-vous sûr de vouloir supprimer cette facture ?')) {
            this.data.invoices = this.data.invoices.filter(i => i.id !== id);
            this.saveData();
            this.renderInvoices();
            this.showToast('Facture supprimée avec succès', 'success');
        }
    }

    // printInvoice(id) {
    //     //this.showToast('Fonction d\'impression simulée - Facture prête à imprimer', 'info');
    // }


    printInvoice(id) {
        const invoice = this.data.invoices.find(i => i.id === id);
        if (!invoice) {
            this.showToast('Facture introuvable', 'error');
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');

        // --- Entreprise émettrice ---
        const company = this.company || {};

        // --- Client ---
        const client = this.data.clients.find(c => c.id === invoice.clientId) || {
            name: "Nom Client",
            address: "Adresse Client"
        };

        // --- Position initiale ---
        const startX = 20;
        let y = 20;
        const offset = 6;

        // --- Bloc entreprise ---
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text(String(company.name || ""), startX, y);

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");

        const companyLines = [
            company.address,
            company.phone,
            company.email,
            company.siret
        ];

        companyLines.forEach(line => {
            if (line) {
                y += offset;
                doc.text(String(line), startX, y);
            }
        });

        // --- Bloc facture (droite) ---
        const rightX = 150;
        let yRight = 20;
        doc.setFont("helvetica", "bold");
        doc.text(`Facture N°: ${String(invoice.number || "")}`, rightX, yRight);
        yRight += offset;
        doc.setFont("helvetica", "normal");
        doc.text(`Date: ${String(invoice.date || "")}`, rightX, yRight);
        yRight += offset;
        doc.text(`Date d'échéance: ${String(invoice.dueDate || "")}`, rightX, yRight);

        // --- Bloc client ---
        y += 15;
        doc.setFont("helvetica", "bold");
        doc.text("Client :", startX, y);
        y += offset;
        doc.setFont("helvetica", "normal");
        doc.text(String(client.name || ""), startX, y);
        y += offset;
        (client.address || "").split("\n").forEach(line => {
            if (line) {
                y += offset;
                doc.text(String(line), startX, y);
            }
        });

        // --- Bloc mission ---
        const missionForInvoice = this.data.missions.find(m => m.id === invoice.missionId);
        if (missionForInvoice) {
            y += 12;
            doc.setFont("helvetica", "bold");
            doc.text("Mission :", startX, y);
            y += offset;
            doc.setFont("helvetica", "normal");
            doc.text(String(missionForInvoice.title || ""), startX, y);
            if (missionForInvoice.description) {
                const descLines = doc.splitTextToSize(String(missionForInvoice.description), 170);
                descLines.forEach(line => {
                    y += offset;
                    doc.text(line, startX, y);
                });
            }
        }

        // --- Tableau items / ligne principale ---
        y += 15;
        const tableColumns = ["LIBELLE", "Qté", "P.U", "TOTAL"];
        let tableRows = [];

        if (invoice.items && Array.isArray(invoice.items) && invoice.items.length > 0) {
            tableRows = invoice.items.map(item => [
                String(item.description || ""),
                String(item.quantity || 1),
                item.price !== undefined ? item.price.toFixed(2) + " €" : "-",
                item.total !== undefined ? item.total.toFixed(2) + " €" : ((item.quantity||1)*(item.price||0)).toFixed(2) + " €"
            ]);
        } else {
            tableRows = [
                [`Facture ${String(invoice.number || "")}`, "1", (invoice.amount || 0).toFixed(2) + " €", (invoice.amount || 0).toFixed(2) + " €"]
            ];
        }

        // --- Totaux ---
        const amountHT = invoice.amount || 0;
        const vatRate = invoice.vatRate || 0;
        const amountTVA = amountHT * (vatRate / 100);
        const totalTTC = amountHT + amountTVA;

        tableRows.push(["", "", "Total HT", amountHT.toFixed(2) + " €"]);
        tableRows.push(["", "", `TVA ${vatRate}%`, amountTVA.toFixed(2) + " €"]);
        tableRows.push(["", "", "Total TTC", totalTTC.toFixed(2) + " €"]);

        doc.autoTable({
            startY: y,
            head: [tableColumns],
            body: tableRows,
            theme: 'grid',
            headStyles: { fillColor: [41, 128, 185], textColor: 255 },
            styles: { fontSize: 10 }
        });

        // --- Pied de page ---
        const finalY = doc.lastAutoTable.finalY || y + 40;
        doc.setFontSize(10);
        const footerLines = [
            company.tva_value ? `TVA: ${String(company.tva_value)}` : '',
            company.nda ? `NDA: ${String(company.nda)}` : '',
            company.iban ? `IBAN: ${String(company.iban)}` : ''
        ].filter(Boolean);
        if (footerLines.length) {
            doc.text(footerLines.join('   '), startX, finalY + 10);
        }

        // --- Télécharger le PDF ---
        const dateForName = (invoice.date || new Date().toISOString().split('T')[0]).split('-');
        const fileName = `${dateForName[2]}-${dateForName[1]}-facture.pdf`;
        doc.save(fileName);
    }

// fin invoice

    generateInvoiceNumber() {
        const year = new Date().getFullYear();
        const existing = this.data.invoices.filter(i => i.number.includes(year.toString()));
        const nextNumber = existing.length + 1;
        return `FACT-${year}-${nextNumber.toString().padStart(3, '0')}`;
    }

    showModal() {
        document.getElementById('modal').classList.remove('hidden');
    }

    closeModal() {
        document.getElementById('modal').classList.add('hidden');
        this.currentFormType = null;
        this.currentEditItem = null;
    }

    handleModalSave() {
        if (!this.currentFormType) return;

        const form = document.querySelector(`#${this.currentFormType}-form`);
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        switch (this.currentFormType) {
            case 'client':
                this.saveClient();
                break;
            case 'mission':
                this.saveMission();
                break;
            case 'cra':
                this.saveCRA();
                break;
            case 'invoice':
                this.saveInvoice();
                break;
            case 'company':
                this.saveCompany();
                break;
        }
    }

    saveClient() {
        const formData = {
            company: document.getElementById('company').value,
            siren: document.getElementById('siren').value,
            address: document.getElementById('address').value,
            contact: {
                name: document.getElementById('contact-name').value,
                email: document.getElementById('contact-email').value,
                phone: document.getElementById('contact-phone').value
            },
            billingAddress: document.getElementById('billing-address').value,
            billingEmail: document.getElementById('billing-email') ? document.getElementById('billing-email').value : '',
            notes: document.getElementById('client-notes') ? document.getElementById('client-notes').value : ''
        };

        if (!/^\d{9}$/.test(formData.siren)) {
            this.showToast('Le SIREN doit contenir exactement 9 chiffres', 'error');
            return;
        }

        if (this.currentEditItem) {
            const index = this.data.clients.findIndex(c => c.id === this.currentEditItem.id);
            this.data.clients[index] = { ...this.currentEditItem, ...formData };
            this.showToast('Client modifié avec succès', 'success');
        } else {
            const newClient = {
                id: Math.max(0, ...this.data.clients.map(c => c.id)) + 1,
                ...formData,
                createdAt: new Date().toISOString().split('T')[0]
            };
            this.data.clients.push(newClient);
            this.showToast('Client ajouté avec succès', 'success');
        }

        this.saveData();
        this.renderClients();
        this.closeModal();
    }

    saveMission() {
        const formData = {
            title: document.getElementById('mission-title').value,
            description: document.getElementById('mission-description').value,
            clientId: parseInt(document.getElementById('mission-client').value),
            startDate: document.getElementById('start-date').value,
            endDate: document.getElementById('end-date').value,
            dailyRate: parseFloat(document.getElementById('daily-rate').value),
            vatRate: parseFloat(document.getElementById('vatRate').value),
            status: document.getElementById('mission-status').value

        };

        if (new Date(formData.startDate) > new Date(formData.endDate)) {
            this.showToast('La date de fin doit être postérieure à la date de début', 'error');
            return;
        }

        if (this.currentEditItem) {
            const index = this.data.missions.findIndex(m => m.id === this.currentEditItem.id);
            this.data.missions[index] = { ...this.currentEditItem, ...formData };
            this.showToast('Mission modifiée avec succès', 'success');
        } else {
            const newMission = {
                id: Math.max(0, ...this.data.missions.map(m => m.id)) + 1,
                ...formData,
                createdAt: new Date().toISOString().split('T')[0]
            };
            this.data.missions.push(newMission);
            this.showToast('Mission ajoutée avec succès', 'success');
        }

        this.saveData();
        this.renderMissions();
        this.closeModal();
    }

    saveInvoice() {
        const formData = {
            number: document.getElementById('invoice-number').value,
            date: document.getElementById('invoice-date').value,
            clientId: parseInt(document.getElementById('invoice-client').value),
            missionId: parseInt(document.getElementById('invoice-mission').value),
            amount: parseFloat(document.getElementById('invoice-amount').value),
            vatRate: parseFloat(document.getElementById('invoice-vat').value),
            status: document.getElementById('invoice-status').value,
            dueDate: document.getElementById('invoice-due-date').value,
            paidDate: document.getElementById('invoice-paid-date').value || null
        };

        if (this.currentEditItem) {
            const index = this.data.invoices.findIndex(i => i.id === this.currentEditItem.id);
            this.data.invoices[index] = { ...this.currentEditItem, ...formData };
            this.showToast('Facture modifiée avec succès', 'success');
        } else {
            const newInvoice = {
                id: Math.max(0, ...this.data.invoices.map(i => i.id)) + 1,
                ...formData,
                createdAt: new Date().toISOString().split('T')[0]
            };
            this.data.invoices.push(newInvoice);
            this.showToast('Facture ajoutée avec succès', 'success');
        }

        this.saveData();
        this.renderInvoices();
        this.closeModal();
    }

    saveCompany() {
        this.company = {
            name: document.getElementById('comp-name').value,
            address: document.getElementById('comp-address').value,
            phone: document.getElementById('comp-phone').value,
            email: document.getElementById('comp-email').value,
            siret: document.getElementById('comp-siret').value,
            tva_value: document.getElementById('comp-tva').value,
            nda: document.getElementById('comp-nda').value,
            iban: document.getElementById('comp-iban').value
        };
        // CORRECTION: Sauvegarder dans SQLite via saveData()
        this.saveData();
        // CORRECTION: Mettre à jour tous les affichages
        this.renderCompanyInfo();
        this.renderCompanyHeader();
        this.closeModal();
        this.showToast('Informations société enregistrées', 'success');
    }


    getStatusClass(status) {
        switch (status) {
            case 'En attente': return 'waiting';
            case 'En cours': return 'active';
            case 'Terminée': return 'completed';
            case 'Facturée': return 'invoiced';
            default: return 'waiting';
        }
    }

    getInvoiceStatusClass(status) {
        switch (status) {
            case 'Brouillon': return 'draft';
            case 'Envoyée': return 'sent';
            case 'Payée': return 'paid';
            case 'En retard': return 'overdue';
            default: return 'draft';
        }
    }

    showToast(message, type = 'info', duration = 3000) {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast toast--${type}`;
        
        toast.innerHTML = `
            <div class="toast-content">
                <p>${message}</p>
            </div>
        `;
        
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, duration);
    }
}


const app = new FreelanceERP();

