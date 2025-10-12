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
                tva_id: '',
                nda: '',
                iban: ''
            }
        };
        this.backend = { url: '', apiKey: '' };
        this.globalYear = null; // shared year filter across pages (null = all)
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
        // Populate dashboard year filter and listen to changes
        const yearSelect = document.getElementById('dashboard-year-filter');
        if (yearSelect) {
            yearSelect.addEventListener('change', (e) => {
                // set global shared year filter
                const v = e.target.value || null;
                this.globalYear = v;
                        // when global changes, update dashboard and charts
                        this.updateDashboard();
                        this.renderCharts();
                        // reflect global on other year selects
                        ['mission-year-filter','invoice-year-filter','cra-year-filter'].forEach(id => {
                            const el = document.getElementById(id);
                            if (el) el.value = v || '';
                        });
            });
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
        // Return boolean indicating whether remote sync succeeded (or not needed).
        if (!this.backend.url || !this.backend.apiKey) {
            // No backend configured — consider save successful locally
            return true;
        }

        try {
            if (!this.suppressRemoteSync) {
                await this.syncSaveToServerSilent();
            }
            return true;
        } catch (e) {
            console.error('Erreur de sauvegarde serveur:', e);
            this.showToast('Échec de synchronisation avec le serveur', 'warning');
            return false;
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
                        <label class="form-label" for="comp-tva">TVA (tva_id)</label>
                        <input type="text" id="comp-tva" class="form-control" value="${c.tva_id || ''}">
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
    const missionYearEl = document.getElementById('mission-year-filter');
    if (missionYearEl) missionYearEl.addEventListener('change', (e) => { this.globalYear = e.target.value || null; this.populateDashboardYearFilter(); this.updateDashboard(); this.renderMissions(); this.renderCharts(); });
        document.getElementById('invoice-status-filter').addEventListener('change', () => this.renderInvoices());
    const invoiceYearEl = document.getElementById('invoice-year-filter');
    if (invoiceYearEl) invoiceYearEl.addEventListener('change', (e) => { this.globalYear = e.target.value || null; this.populateDashboardYearFilter(); this.updateDashboard(); this.renderInvoices(); this.renderCharts(); });
    document.getElementById('cra-month-filter').addEventListener('change', () => this.renderCRAs());
    const craYearEl = document.getElementById('cra-year-filter');
    if (craYearEl) craYearEl.addEventListener('change', (e) => { this.globalYear = e.target.value || null; this.populateDashboardYearFilter(); this.renderCRAs(); this.updateDashboard(); this.renderCharts(); });


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
        // Respect selected year filter for dashboard numbers
        const selectedYear = this.getSelectedYear();
        const filtered = this.getFilteredData(selectedYear);

        const totalRevenue = filtered.invoices
            .filter(invoice => invoice.status === 'Payée')
            .reduce((sum, invoice) => sum + (invoice.amount * (1 + invoice.vatRate / 100)), 0);

        const pendingRevenue = filtered.invoices
            .filter(invoice => invoice.status == 'Envoyée' || invoice.status == 'En retard' )
            .reduce((sum, invoice) => sum + (invoice.amount * (1 + invoice.vatRate / 100)), 0);

        const generatedRevenue = totalRevenue + pendingRevenue;

        const activeMissions = filtered.missions.filter(m => m.status === 'En cours').length;
        const pendingInvoices = filtered.invoices.filter(i => i.status === 'Envoyée').length;
        const totalClients = this.data.clients.length; // clients are not year-scoped

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
        this.populateDashboardYearFilter();
        this.populateInvoiceFilters();
    }

    populateInvoiceFilters() {
        const yearSelect = document.getElementById('invoice-year-filter');
        if (!yearSelect) return;
        const years = this.getAvailableYears();
    yearSelect.innerHTML = '<option value="">Toutes les années</option>' + years.map(y => `<option value="${y}">${y}</option>`).join('');
    yearSelect.value = this.globalYear || '';
    this.updateYearBadge();
    }

    populateDashboardYearFilter() {
        const select = document.getElementById('dashboard-year-filter');
        if (!select) return;
        const years = this.getAvailableYears();
        const existing = select.value || '';
        let html = '<option value="">Toutes les années</option>' + years.map(y => `<option value="${y}">${y}</option>`).join('');
        select.innerHTML = html;
        // prefer the shared global year if set, otherwise keep previous selection
        if (this.globalYear) select.value = this.globalYear; else if (existing) select.value = existing;
        this.updateYearBadge();
    }

    getAvailableYears() {
        const years = new Set();
        this.data.cras.forEach(c => { if (c.month) years.add(c.month.split('-')[0]); });
        this.data.invoices.forEach(i => { if (i.date) years.add(i.date.slice(0,4)); if (i.paidDate) years.add(i.paidDate.slice(0,4)); });
        this.data.missions.forEach(m => { if (m.startDate) years.add(new Date(m.startDate).getFullYear().toString()); if (m.endDate) years.add(new Date(m.endDate).getFullYear().toString()); });
        // Always include the current year so the selector contains it automatically
        try { years.add(new Date().getFullYear().toString()); } catch (_) { /* ignore */ }
        return [...years].sort();
    }

    getSelectedYear() {
        // For backward compatibility, this returns the global year
        return this.globalYear || null;
    }

    updateYearBadge() {
        const badge = document.getElementById('year-badge');
        const label = document.getElementById('year-badge-label');
        const clearBtn = document.getElementById('year-badge-clear');
        if (!badge || !label || !clearBtn) return;
        const y = this.getSelectedYear();
        if (!y) {
            badge.style.display = 'none';
            return;
        }
        label.textContent = `Année : ${y}`;
        badge.style.display = 'inline-flex';
        clearBtn.onclick = () => {
            this.globalYear = null;
            // reset selects
            ['dashboard-year-filter','mission-year-filter','invoice-year-filter','cra-year-filter'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
            this.updateDashboard();
            this.renderCharts();
            this.updateYearBadge();
        };
    }

    getFilteredData(selectedYear) {
        if (!selectedYear) {
            return { clients: this.data.clients, missions: this.data.missions, invoices: this.data.invoices, cras: this.data.cras };
        }
        const yr = parseInt(selectedYear, 10);
        const yearStart = new Date(yr, 0, 1, 0, 0, 0);
        const yearEnd = new Date(yr, 11, 31, 23, 59, 59);
        const missions = this.data.missions.filter(m => {
            // include mission if its date range intersects the selected year
            if (!m.startDate && !m.endDate) return false;
            const s = m.startDate ? new Date(m.startDate) : (m.endDate ? new Date(m.endDate) : null);
            const e = m.endDate ? new Date(m.endDate) : (m.startDate ? new Date(m.startDate) : null);
            if (!s || !e) return false;
            return s <= yearEnd && e >= yearStart;
        });
        const invoices = this.data.invoices.filter(i => {
            const d = i.date ? i.date.slice(0,4) : null;
            const pd = i.paidDate ? i.paidDate.slice(0,4) : null;
            return d == selectedYear || pd == selectedYear;
        });
        const cras = this.data.cras.filter(c => c.month ? c.month.split('-')[0] == selectedYear : false);
        return { clients: this.data.clients, missions, invoices, cras };
    }

    renderCompanyInfo() {
        const el = document.getElementById('company-card');
        if (!el) return;
        const c = this.company || {};
        
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
                ${c.tva_id ? `<div class="item"><label>TVA</label><div>${c.tva_id}</div></div>` : ''}
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
                <span>${c.tva_id || ''}</span>
                <span>${c.iban || ''}</span>
            </div>
        `;
    }

    renderCharts() {
        const genCanvas = document.getElementById('chart-generated');
        const paidCanvas = document.getElementById('chart-paid');
        const totalCanvas = document.getElementById('chart-total');
        if (!window.Chart || (!genCanvas && !paidCanvas && !totalCanvas)) return;

        // Build datasets from already computed tables (respect selected year)
        const selectedYear = this.getSelectedYear();
        const { cras, invoices } = this.getFilteredData(selectedYear);

        const genMap = new Map();
        for (const cra of cras) {
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
        for (const inv of invoices) {
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
        const selectedYear = this.getSelectedYear();
        const { cras, missions } = this.getFilteredData(selectedYear);
        const map = new Map(); // month -> { days, amountHT, vat, total }
        for (const cra of cras) {
            const mission = missions.find(m => m.id === cra.missionId) || this.data.missions.find(m => m.id === cra.missionId);
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
        const selectedYear = this.getSelectedYear();
        const invoices = this.getFilteredData(selectedYear).invoices;
        const map = new Map(); // YYYY-MM -> { amountHT, vat, total }
        for (const inv of invoices) {
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
        const selectedYear = this.getSelectedYear();
        const missions = this.getFilteredData(selectedYear).missions;
        const recentMissions = missions
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
    const selectedYear = this.getSelectedYear();
    const invoices = this.getFilteredData(selectedYear).invoices;
    const pendingInvoices = invoices.filter(i => i.status === 'Envoyée' || i.status === 'En retard');

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

    async deleteClient(id) {
        // Prevent deletion if client has linked missions or invoices
        const linkedMission = this.data.missions.find(m => m.clientId === id);
        const linkedInvoice = this.data.invoices.find(i => i.clientId === id);
        if (linkedMission || linkedInvoice) {
            this.showToast('Impossible de supprimer le client : des missions ou factures lui sont liées.', 'error');
            return;
        }
        if (confirm('Êtes-vous sûr de vouloir supprimer ce client ?')) {
            this.data.clients = this.data.clients.filter(c => c.id !== id);
            const ok = await this.saveData();
            if (!ok) {
                this.showToast('Suppression non sauvegardée sur le serveur. Vérifiez la connexion.', 'error');
                return;
            }
            this.renderClients();
            this.showToast('Client supprimé avec succès', 'success');
        }
    }

    renderMissions() {
        const statusFilter = document.getElementById('mission-status-filter').value;
        const clientFilter = document.getElementById('mission-client-filter').value;
        const selectedYear = this.getSelectedYear();
        let filteredMissions = this.getFilteredData(selectedYear).missions;

        if (statusFilter) filteredMissions = filteredMissions.filter(m => m.status === statusFilter);
        if (clientFilter) filteredMissions = filteredMissions.filter(m => m.clientId === parseInt(clientFilter));

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
        if (clientFilter) {
            clientFilter.innerHTML = '<option value="">Tous les clients</option>' +
                this.data.clients.map(client => 
                    `<option value="${client.id}">${client.company}</option>`
                ).join('');
        }
        // populate year filter
        const yearSelect = document.getElementById('mission-year-filter');
        if (yearSelect) {
            const years = this.getAvailableYears();
            yearSelect.innerHTML = '<option value="">Toutes les années</option>' + years.map(y => `<option value="${y}">${y}</option>`).join('');
            yearSelect.value = this.globalYear || '';
        }
        this.updateYearBadge();
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

    async deleteMission(id) {
        // Prevent deletion if mission has linked invoices
        const linkedInvoice = this.data.invoices.find(i => i.missionId === id);
        if (linkedInvoice) {
            this.showToast('Impossible de supprimer la mission : des factures y sont liées.', 'error');
            return;
        }
        if (confirm('Êtes-vous sûr de vouloir supprimer cette mission ?')) {
            this.data.missions = this.data.missions.filter(m => m.id !== id);
            const ok = await this.saveData();
            if (!ok) {
                this.showToast('Suppression non sauvegardée sur le serveur. Vérifiez la connexion.', 'error');
                return;
            }
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
        const selectedYear = this.getSelectedYear();

        let filteredCRAs = this.getFilteredData(selectedYear).cras;
        if (monthFilter) filteredCRAs = filteredCRAs.filter(cra => cra.month === monthFilter);

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
        const yearFilter = document.getElementById('cra-year-filter');
        const months = [...new Set(this.data.cras.map(cra => cra.month))].sort().reverse();
        const years = [...new Set(this.data.cras.map(cra => cra.month ? cra.month.split('-')[0] : null).filter(Boolean))].sort().reverse();

        if (monthFilter) {
            monthFilter.innerHTML = '<option value="">Tous les mois</option>' +
                months.map(month => `<option value="${month}">${this.formatMonth(month)}</option>`).join('');
        }
        if (yearFilter) {
            yearFilter.innerHTML = '<option value="">Toutes les années</option>' + years.map(y => `<option value="${y}">${y}</option>`).join('');
            // set to follow global by default
            yearFilter.value = this.globalYear || '';
        }
        this.updateYearBadge();
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
        // if (backendKeyEl) backendKeyEl.textContent = this.backend.apiKey || 'Non défini';
        if (backendKeyEl) {
        const key = this.backend.apiKey;
        // display only last 4 characters for security
        backendKeyEl.textContent = key ? '*'.repeat(key.length - 4) + key.slice(-4) : 'Non défini';
        }
    
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
        const selectedYear = this.getSelectedYear();
        let filteredInvoices = this.getFilteredData(selectedYear).invoices;

        if (statusFilter) filteredInvoices = filteredInvoices.filter(i => i.status === statusFilter);

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
        let activityMonth = new Date().toISOString().slice(0, 7);
        // activityMont is the month of the work done, default to current month
        if (cra && cra.month) {
            // Use CRA activity month
            const [year, month] = cra.month.split('-');
            const lastDay = new Date(year, month, 0).getDate();
            activityMonth = `${year}-${month}`;
        }
        
        // predict invoice number based on next id and chosen date so the user sees the final number
        const predictedId = Math.max(0, ...this.data.invoices.map(i => i.id)) + 1;
        const invoiceDateForPrediction = invoice ? invoice.date : invoiceDate;
        const yearForPrediction = (invoiceDateForPrediction || new Date().toISOString().split('T')[0]).slice(0,4);
        const predictedNumber = `FA${yearForPrediction.slice(-2)}-1${String(predictedId).padStart(4,'0')}`;

        // Compute quantity par défaut
        let defaultQuantity = 1;
        if (cra && cra.daysWorked) {
            // Si créé depuis un CRA, utiliser les jours du CRA
            defaultQuantity = cra.daysWorked;
        } else if (mission && mission.dailyRate && amount) {
            // Sinon calculer depuis amount/dailyRate
            defaultQuantity = Math.round((amount / mission.dailyRate) * 100) / 100;
        }

        document.getElementById('modal-title').textContent = title;
        document.getElementById('modal-body').innerHTML = `
            <form id="invoice-form">
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label" for="invoice-number">Numéro</label>
                        <input type="text" id="invoice-number" class="form-control" value="${invoice ? invoice.number : predictedNumber}" readonly>
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
                        <label class="form-label" for="invoice-quantity">Quantité (jours/unités) *</label>
                        <input type="number" id="invoice-quantity" class="form-control" value="${invoice ? invoice.quantity || 1 : defaultQuantity}" min="0.5" step="0.5" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="invoice-amount">Montant unitaire HT (€) *</label>
                        <input type="number" id="invoice-amount" class="form-control" value="${invoice ? invoice.amount : amount}" min="0" step="0.01" required>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label" for="invoice-vat">TVA (%) *</label>
                        <input type="number" id="invoice-vat" class="form-control" value="${invoice ? invoice.vatRate : 20}" min="0" max="100" step="0.01" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="invoice-template">Modèle d'impression</label>
                        <select id="invoice-template" class="form-control">
                            <option value="standard" ${invoice && invoice.invoiceTemplate === 'standard' ? 'selected' : ''}>Standard (avec frais)</option>
                            <option value="minimal" ${invoice && invoice.invoiceTemplate === 'minimal' ? 'selected' : ''}>Minimaliste</option>
                        </select>
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
                        <label class="form-label" for="invoice-date">Période Activité *</label>
                        <input type="month" id="invoice-activity-month" class="form-control" value="${invoice ? invoice.activityMonth : activityMonth}">
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="invoice-paid-date">Date de paiement</label>
                        <input type="date" id="invoice-paid-date" class="form-control" value="${invoice && invoice.paidDate ? invoice.paidDate : ''}" ${invoice && invoice.status === 'Payée' ? '' : 'disabled'}>
                    </div>
                </div>

                <div style="background: #f9fafb; padding: 12px; border-radius: 8px; margin-top: 16px;">
                    <p style="margin: 0 0 8px 0; font-weight: 600;">Résumé</p>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 13px;">
                        <div><span style="color: var(--color-text-secondary);">Montant HT :</span> <span id="summary-ht" style="font-weight: 600;">0€</span></div>
                        <div><span style="color: var(--color-text-secondary);">TVA :</span> <span id="summary-vat" style="font-weight: 600;">0€</span></div>
                        <div style="grid-column: 1/-1;"><span style="color: var(--color-text-secondary);">Total TTC :</span> <span id="summary-ttc" style="font-weight: 600; color: var(--color-primary); font-size: 14px;">0€</span></div>
                    </div>
                </div>

                ${cra ? `<p class="info-text" style="margin-top: 16px; padding: 8px; background: #e8f5e9; border-radius: 4px;">💡 Facture générée depuis le CRA de ${this.formatMonth(cra.month)} (${cra.daysWorked} jours travaillés)</p>` : ''}
            </form>
        `;

        // Compute the summary and display it in the form bottom
        const updateSummary = () => {
            const quantity = parseFloat(document.getElementById('invoice-quantity').value) || 0;
            const amount = parseFloat(document.getElementById('invoice-amount').value) || 0;
            const vat = parseFloat(document.getElementById('invoice-vat').value) || 0;

            const ht = amount;
            const vatAmount = ht * (vat / 100);
            const ttc = ht + vatAmount;

            document.getElementById('summary-ht').textContent = ht.toLocaleString('fr-FR', {maximumFractionDigits: 2}) + '€';
            document.getElementById('summary-vat').textContent = vatAmount.toLocaleString('fr-FR', {maximumFractionDigits: 2}) + '€';
            document.getElementById('summary-ttc').textContent = ttc.toLocaleString('fr-FR', {maximumFractionDigits: 2}) + '€';
        };

        // Update automatically the listeners
        ['invoice-quantity', 'invoice-amount', 'invoice-vat'].forEach(id => {
            document.getElementById(id).addEventListener('input', updateSummary);
        });
        updateSummary();

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


    printInvoice(id) {
        const invoice = this.data.invoices.find(i => i.id === id);
        if (!invoice) {
            this.showToast('Facture introuvable', 'error');
            return;
        }
        const templateName = invoice.invoiceTemplate || 'standard';
        this.printInvoiceHTML(id, templateName);
    }
    

    async  printInvoiceHTML(invoiceId, templateName = 'standard') {
        const invoice = this.data.invoices.find(i => i.id === invoiceId);
        if (!invoice) {
            this.showToast('Facture introuvable', 'error');
            return;
        }

        const client = this.data.clients.find(c => c.id === invoice.clientId);
        const mission = this.data.missions.find(m => m.id === invoice.missionId);
        const company = this.company || {};

        if (!client || !mission) {
            this.showToast('Client ou mission introuvable', 'error');
            return;
        }

        // prepare data for template
        const templateData = {
            company: {
                name: company.name || '',
                address: (company.address || '').replace(/\n/g, '<br>'),
                email: company.email || '',
                phone: company.phone || '',
                siret: company.siret || '',
                tva_id: company.tva_id || '',
                nda: company.nda || '',
                iban: company.iban || ''
            },
            client: {
                company: client.company || '',
                siren: client.siren || '',
                address: (client.billingAddress || client.address || '').replace(/\n/g, '<br>'),
                contact: {
                    name: client.contact?.name || '',
                    email: client.contact?.email || '',
                    phone: client.contact?.phone || ''
                }
            },
            mission: {
                title: mission.title || '',
                description: mission.description || '',
                dailyRate: (mission.dailyRate || 0).toFixed(2)
            },
            invoice: {
                number: invoice.number || '',
                date: invoice.date || '',
                dueDate: invoice.dueDate || '',
                quantity: invoice.quantity || 1,
                amountHT: (invoice.amount || 0).toFixed(2),
                activityMonth: `${invoice.activityMonth}`,
                vatRate: invoice.vatRate || 20,
                
                // Optionnel: additionnal fees (not yet in UI) when usting "invoice standard" template
                // travelFees will include all at one: transportFees + accommodationFees + mealFees
                // For now we set them to 0
                travelFees: 0,
                travelQtity: 0,

                onCallQtity: 0,
                onCallRate: 0,
                onCallAmount: 0,
                
                // Calculs
                subtotalHT: (invoice.amount || 0).toFixed(2),
                vatAmount: ((invoice.amount || 0) * ((invoice.vatRate || 0) / 100)).toFixed(2),
                totalTTC: ((invoice.amount || 0) * (1 + (invoice.vatRate || 0) / 100)).toFixed(2)
            }
        };

        // Select the template template
        const template = INVOICE_TEMPLATES[templateName] || INVOICE_TEMPLATES.minimal;
        if (!template) {
            this.showToast('Template non trouvé', 'error');
            return;
        }

        // Generate the HTML data with substitutions
        const html = substituteTemplate(template, templateData);

        // Convert to PDF with  html2pdf
        const opt = {
            margin: 10,
            filename: `${invoice.number}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { orientation: 'p', unit: 'mm', format: 'a4' }
        };

        // Ensure that html2pdf is loadeded
        if (typeof html2pdf !== 'undefined') {
            html2pdf().set(opt).from(html).save();
        } else {
            this.showToast('Bibliothèque html2pdf non chargée', 'error');
        }
    }

    generateInvoiceNumber() {
        const now = new Date();
        const yearFull = now.getFullYear();
        const yearShort = yearFull.toString().slice(-2);

        // Looser pattern: accept FAyy-1NNNN or FAyy-10001 etc, case-insensitive
        const regex = new RegExp(`FA${yearShort}-1(\d{4,})`, 'i');
        let maxSeq = 0;

        for (const inv of this.data.invoices || []) {
            if (!inv || !inv.number) continue;
            const m = String(inv.number).match(regex);
            if (m && m[1]) {
                const seq = parseInt(m[1], 10);
                if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
            }
        }

        // If we generated a number moments ago, track it to avoid duplicates
        if (!this._lastInvoiceSeq || this._lastInvoiceYear !== yearFull) {
            this._lastInvoiceYear = yearFull;
            this._lastInvoiceSeq = maxSeq;
        }

        const nextSeq = Math.max(maxSeq, this._lastInvoiceSeq) + 1;
        this._lastInvoiceSeq = nextSeq;

        const padded = String(nextSeq).padStart(4, '0');
        return `FA${yearShort}-1${padded}`;
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

    async saveClient() {
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
        } else {
            const newClient = {
                id: Math.max(0, ...this.data.clients.map(c => c.id)) + 1,
                ...formData,
                createdAt: new Date().toISOString().split('T')[0]
            };
            this.data.clients.push(newClient);
        }

        const ok = await this.saveData();
        if (!ok) {
            this.showToast('Enregistrement non sauvegardé sur le serveur. Vérifiez la connexion.', 'error');
            // keep modal open so user can retry
            return;
        }

        this.renderClients();
        this.showToast(this.currentEditItem ? 'Client modifié avec succès' : 'Client ajouté avec succès', 'success');
        this.closeModal();
    }

    async saveMission() {
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
        } else {
            const newMission = {
                id: Math.max(0, ...this.data.missions.map(m => m.id)) + 1,
                ...formData,
                createdAt: new Date().toISOString().split('T')[0]
            };
            this.data.missions.push(newMission);
        }

        const ok = await this.saveData();
        if (!ok) {
            this.showToast('Enregistrement non sauvegardé sur le serveur. Vérifiez la connexion.', 'error');
            return;
        }

        this.renderMissions();
        this.showToast(this.currentEditItem ? 'Mission modifiée avec succès' : 'Mission ajoutée avec succès', 'success');
        this.closeModal();
    }

    async saveInvoice() {
        const formData = {
            number: document.getElementById('invoice-number').value,
            date: document.getElementById('invoice-date').value,
            activityMonth: document.getElementById('invoice-activity-month').value,
            clientId: parseInt(document.getElementById('invoice-client').value),
            missionId: parseInt(document.getElementById('invoice-mission').value),
            quantity: parseFloat(document.getElementById('invoice-quantity').value),
            amount: parseFloat(document.getElementById('invoice-amount').value),
            vatRate: parseFloat(document.getElementById('invoice-vat').value),
            invoiceTemplate: document.getElementById('invoice-template').value,
            status: document.getElementById('invoice-status').value,
            dueDate: document.getElementById('invoice-due-date').value,
            paidDate: document.getElementById('invoice-paid-date').value || null
        };

        if (this.currentEditItem) {
            const index = this.data.invoices.findIndex(i => i.id === this.currentEditItem.id);
            this.data.invoices[index] = { ...this.currentEditItem, ...formData };
        } else {
            // assign a unique id first
            const newId = Math.max(0, ...this.data.invoices.map(i => i.id)) + 1;
            // determine year from the invoice date (fall back to current year)
            const invoiceYear = formData.date ? formData.date.slice(0,4) : (new Date().getFullYear().toString());
            const yearShort = invoiceYear.slice(-2);
            // build number from id to guarantee uniqueness (FAyy-1NNNN where NNNN is padded id)
            formData.number = `FA${yearShort}-1${String(newId).padStart(4, '0')}`;

            const newInvoice = {
                id: newId,
                ...formData,
                createdAt: new Date().toISOString().split('T')[0]
            };
            this.data.invoices.push(newInvoice);
        }

        const ok = await this.saveData();
        if (!ok) {
            this.showToast('Enregistrement non sauvegardé sur le serveur. Vérifiez la connexion.', 'error');
            return;
        }

        this.renderInvoices();
        this.showToast(this.currentEditItem ? 'Facture modifiée avec succès' : 'Facture ajoutée avec succès', 'success');
        this.closeModal();
    }

    saveCompany() {
        this.company = {
            name: document.getElementById('comp-name').value,
            address: document.getElementById('comp-address').value,
            phone: document.getElementById('comp-phone').value,
            email: document.getElementById('comp-email').value,
            siret: document.getElementById('comp-siret').value,
            tva_id: document.getElementById('comp-tva').value,
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

