// À ajouter dans app.js ou dans un fichier séparé invoiceTemplates.js

// Définition des templates disponibles
const INVOICE_TEMPLATES = {
    // Template standard avec frais et astreinte
    standard: `
      <div style="font-family: Arial, sans-serif; font-size: 14px; padding: 20px; color: #000000;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 30px;">
                  <div style="width: 45%; border: 1px solid #ccc; padding: 10px;">
                      <strong>Émetteur :</strong><br>
                      <br>
                      {{company.name}}<br>
                      {{company.address}}<br>
                      {{company.email}}<br>
                      <br>
                      SIRET {{company.siret}}<br>
		                  TVA {{company.tva_id}}<br>
                  </div>
                  <div style="width: 45%; text-align: right; border: 1px solid #ccc; padding: 10px;">
                      <strong>Client :</strong><br>
                      <br>
                      {{client.company}}<br>
                      {{client.address}}<br>
                      <br>
                      SIREN {{client.siren}} 
                  </div>
              </div>
              <div style="margin: 20px 0; display: flex; justify-content: space-between;">
                  <p style="font-weight: bold; margin: 0;">Facture n° {{invoice.number}}</p>
                  <p style="margin: 0;">Date : {{invoice.date}}</p>
              </div>

              <div style="font-style: italic; margin-bottom: 20px; font-weight: bold;">
                  Date d'échéance : {{invoice.dueDate}}
              </div>

              <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                  <tr style="background-color: #E6E6E6;">
                      <th style="border: 1px solid #ccc; padding: 8px; text-align: center;">Libellé</th>
                      <th style="border: 1px solid #ccc; padding: 8px; text-align: center;">Qté</th>
                      <th style="border: 1px solid #ccc; padding: 8px; text-align: center;">P.U</th>
                      <th style="border: 1px solid #ccc; padding: 8px; text-align: center;">Total</th>
                  </tr>
                  <tr>
                      <td style="border: 1px solid #ccc; padding: 8px; vertical-align: top;">
                          Référence: {{mission.description}}<br>
                          <br>
                          Responsable {{client.company}} : {{client.contact.name}}<br>
                          <br>
                          Nature : {{mission.title}}<br>
                          <br>
                          Période : {{invoice.activityMonth}}
                      </td>
                      <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">{{invoice.quantity}}</td>
                      <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">{{mission.dailyRate}}€</td>
                      <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">{{invoice.amountHT}}€</td>
                  </tr>
                  <tr>
                      <td style="border: 1px solid #ccc; padding: 8px;">Frais de déplacement</td>
                      <td style="border: 1px solid #ccc; padding: 8px;"></td>
                      <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">{{invoice.transportFees}}€</td>
                      <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">{{invoice.transportFees}}€</td>
                  </tr>
                  <tr>
                      <td style="border: 1px solid #ccc; padding: 8px;">Astreinte</td>
                      <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">{{invoice.standbyHours}}</td>
                      <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">{{invoice.standbyRate}}€</td>
                      <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">{{invoice.standbyAmount}}€</td>
                  </tr>
                  <tr>
                      <td></td>
                      <td style="border: 1px solid #ccc; padding: 8px; text-align: left; background-color: #E6E6E6;" colspan="2"><strong>Total HT</strong></td>
                      <td style="border: 1px solid #ccc; padding: 8px; text-align: center; " colspan="2"><strong>{{invoice.subtotalHT}}€</strong></td>
                  </tr>
                  <tr style="height: 35px;white-space: nowrap">
                      <td></td>
                      <td style="border: 1px solid #ccc; padding: 8px; text-align: left; background-color: #E6E6E6;" colspan="2"></td>
                      <td style="border: 1px solid #ccc; padding: 8px; text-align: center; " colspan="2"></td>
                  </tr>		  
                  <tr>
                      <td></td>
                      <td style="border: 1px solid #ccc; padding: 8px; text-align: left; background-color: #E6E6E6;" colspan="2">TVA {{invoice.vatRate}}%</td>
                      <td style="border: 1px solid #ccc; padding: 8px; text-align: center;" colspan="2">{{invoice.vatAmount}}€</td>
                  </tr>
                  <tr>
                    <td></td>
                      <td style="border: 1px solid #ccc; padding: 8px; text-align: left; font-weight: bold; background-color: #E6E6E6;" colspan="2">Total TTC</td>
                      <td style="border: 1px solid #ccc; padding: 8px; text-align: center; font-weight: bold;" colspan="2">{{invoice.totalTTC}}€</td>
                  </tr>
              </table>

              <div style="margin-top: 30px; text-align: center;">
                  <p style="margin: 0;">IBAN : {{company.iban}}</p>
              </div>

          </div>

    `,

    // Template minimaliste (sans frais ni astreinte)
    minimal: `
      <div style="font-family: Arial, sans-serif; font-size: 14px; padding: 20px; color: #000000;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 30px;">
                  <div style="width: 45%; border: 1px solid #ccc; padding: 10px;">
                      <strong>Émetteur :</strong><br>
                      <br>
                      {{company.name}}<br>
                      {{company.address}}<br>
                      {{company.email}}<br>
                      <br>
                      SIRET {{company.siret}}<br>
		                  TVA {{company.tva_id}}<br>
                  </div>
                  <div style="width: 45%; text-align: right; border: 1px solid #ccc; padding: 10px;">
                      <strong>Client :</strong><br>
                      <br>
                      {{client.company}}<br>
                      {{client.address}}<br>
                      <br>
                      SIREN {{client.siren}} 
                  </div>
              </div>
              <div style="margin: 20px 0; display: flex; justify-content: space-between;">
                  <p style="font-weight: bold; margin: 0;">Facture n° {{invoice.number}}</p>
                  <p style="margin: 0;">Date : {{invoice.date}}</p>
              </div>

              <div style="font-style: italic; margin-bottom: 20px; font-weight: bold;">
                  Date d'échéance : {{invoice.dueDate}}
              </div>

              <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                  <tr style="background-color: #E6E6E6;">
                      <th style="border: 1px solid #ccc; padding: 8px; text-align: center;">Libellé</th>
                      <th style="border: 1px solid #ccc; padding: 8px; text-align: center;">Qté</th>
                      <th style="border: 1px solid #ccc; padding: 8px; text-align: center;">P.U</th>
                      <th style="border: 1px solid #ccc; padding: 8px; text-align: center;">Total</th>
                  </tr>
                  <tr>
                      <td style="border: 1px solid #ccc; padding: 8px; vertical-align: top;">
                          Référence: {{mission.description}}<br>
                          <br>
                          Responsable {{client.company}} : {{client.contact.name}}<br>
                          <br>
                          Nature : {{mission.title}}<br>
                          <br>
                          Période : {{invoice.activityMonth}}
                      </td>
                      <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">{{invoice.quantity}}</td>
                      <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">{{mission.dailyRate}}€</td>
                      <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">{{invoice.amountHT}}€</td>
                  </tr>
                  <tr>
                      <td></td>
                      <td style="border: 1px solid #ccc; padding: 8px; text-align: left; background-color: #E6E6E6;" colspan="2"><strong>Total HT</strong></td>
                      <td style="border: 1px solid #ccc; padding: 8px; text-align: center; " colspan="2"><strong>{{invoice.subtotalHT}}€</strong></td>
                  </tr>
                  <tr style="height: 35px;white-space: nowrap">
                      <td></td>
                      <td style="border: 1px solid #ccc; padding: 8px; text-align: left; background-color: #E6E6E6;" colspan="2"></td>
                      <td style="border: 1px solid #ccc; padding: 8px; text-align: center; " colspan="2"></td>
                  </tr>		  
                  <tr>
                      <td></td>
                      <td style="border: 1px solid #ccc; padding: 8px; text-align: left; background-color: #E6E6E6;" colspan="2">TVA {{invoice.vatRate}}%</td>
                      <td style="border: 1px solid #ccc; padding: 8px; text-align: center;" colspan="2">{{invoice.vatAmount}}€</td>
                  </tr>
                  <tr>
                    <td></td>
                      <td style="border: 1px solid #ccc; padding: 8px; text-align: left; font-weight: bold; background-color: #E6E6E6;" colspan="2">Total TTC</td>
                      <td style="border: 1px solid #ccc; padding: 8px; text-align: center; font-weight: bold;" colspan="2">{{invoice.totalTTC}}€</td>
                  </tr>
              </table>

              <div style="margin-top: 30px; text-align: center;">
                  <p style="margin: 0;">IBAN : {{company.iban}}</p>
              </div>

          </div>
    `
};

// Fonction de substitution de variables (simple mais robuste)
function substituteTemplate(template, data) {
    let result = template;

    // Remplacer les variables simples {{key.subkey}}
    result = result.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
        const keys = path.trim().split('.');
        let value = data;
        for (const key of keys) {
            value = value?.[key];
        }
        return value !== undefined ? String(value) : '';
    });

    // Remplacer les blocs conditionnels {{#if condition}}...{{/if}}
    result = result.replace(/\{\{#if\s+([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, condition, content) => {
        const keys = condition.trim().split('.');
        let value = data;
        for (const key of keys) {
            value = value?.[key];
        }
        return value ? content : '';
    });

    return result;
}


// Nouvelle fonction printInvoice améliorée
async  function printInvoiceHTML(invoiceId, templateName = 'standard') {
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

    // Préparer les données pour le template
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
            address: (client.address || '').replace(/\n/g, '<br>'),
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
            quantity: 1,
            amountHT: (invoice.amount || 0).toFixed(2),
            period: `${invoice.date}`,
            vatRate: invoice.vatRate || 20,
            
            // Optionnels : frais et astreinte (si nécessaire)
            showTransportFees: false,
            transportFees: 0,
            showStandby: false,
            standbyHours: 0,
            standbyRate: 0,
            standbyAmount: 0,
            
            // Calculs
            subtotalHT: (invoice.amount || 0).toFixed(2),
            vatAmount: ((invoice.amount || 0) * ((invoice.vatRate || 0) / 100)).toFixed(2),
            totalTTC: ((invoice.amount || 0) * (1 + (invoice.vatRate || 0) / 100)).toFixed(2)
        }
    };

    // Sélectionner le template
    const template = INVOICE_TEMPLATES[templateName] || INVOICE_TEMPLATES.standard;
    if (!template) {
        this.showToast('Template non trouvé', 'error');
        return;
    }

    // Générer le HTML
    const html = substituteTemplate(template, templateData);

    // Convertir en PDF avec html2pdf
    const opt = {
        margin: 10,
        filename: `${invoice.number}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { orientation: 'p', unit: 'mm', format: 'a4' }
    };

    // S'assurer que html2pdf est chargé
    if (typeof html2pdf !== 'undefined') {
        html2pdf().set(opt).from(html).save();
    } else {
        this.showToast('Bibliothèque html2pdf non chargée', 'error');
    }
}
