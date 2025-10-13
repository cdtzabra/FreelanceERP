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
                      <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">{{invoice.travelFees}}€</td>
                      <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">{{invoice.travelFees}}€</td>
                  </tr>
                  <tr>
                      <td style="border: 1px solid #ccc; padding: 8px;">Astreinte</td>
                      <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">{{invoice.onCallQtity}}</td>
                      <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">{{invoice.onCallRate}}€</td>
                      <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">{{invoice.onCallAmount}}€</td>
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

// Simple template engine to replace {{key}} and handle {{#if condition}}...{{/if}} blocks
function substituteTemplate(template, data) {
    let result = template;

    // Replace variables {{key.subkey}}
    result = result.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
        const keys = path.trim().split('.');
        let value = data;
        for (const key of keys) {
            value = value?.[key];
        }
        return value !== undefined ? String(value) : '';
    });

    // Replace conditionnal blocks  {{#if condition}}...{{/if}}
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
