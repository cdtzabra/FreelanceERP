<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Facture</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 40px;
    }
    .flex {
      display: flex;
      justify-content: space-between;
    }
    .box {
      border: 1px solid #333;
      padding: 10px;
      width: 45%;
    }
    .info-line {
      margin-top: 20px;
      font-weight: bold;
    }
    .due-date {
      margin-top: 10px;
      font-style: italic;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
    }
    th, td {
      border: 1px solid #333;
      padding: 8px;
      text-align: left;
    }
    .multiline {
      white-space: pre-line;
      font-style: italic;
    }
    .no-border td:first-child {
      border: none;
    }
    .merged {
      text-align: left;
      font-weight: bold;
    }
    .empty-row td {
      border: none;
      height: 20px;
    }
  </style>
</head>
<body>

  <div class="flex">
    <div class="box">
      <strong>Émetteur :</strong><br>
      {{company.name}}<br>
      {{company.address}}<br>
      {{company.email}}<br>
      SIRET : {{company.siret}}
    </div>
    <div class="box">
      <strong>Client :</strong><br>
      {{client.name}}<br>
      {{client.address}}<br>
      {{client.email}}<br>
      SIRET : {{client.siret}}
    </div>
  </div>

  <div class="info-line">
    Facture n° {{invoice.number}} &nbsp;&nbsp;&nbsp; Date : {{created.date}}
  </div>

  <div class="due-date">
    Date d'échéance : {{due.date}}
  </div>

  <table>
    <tr>
      <th>Libellé</th>
      <th>Qté</th>
      <th>P.U</th>
      <th>Total</th>
    </tr>
    <tr>
      <td colspan="4" class="multiline">
        {{mission.title}}<br>
        Responsable {{client.name}} : {{client.contact.name}}<br>
        Nature de la prestation : {{mission.description}}<br>
        Mois de prestation : septembre
      </td>
    </tr>
    <tr>
      <td>Nombre de jours</td>
      <td>{{Quantity}}</td>
      <td>{{mission.dailyRate}}</td>
      <td>{{invoice.amountHT}}</td>
    </tr>
    <tr>
      <td>Frais de déplacement</td>
      <td></td>
      <td></td>
      <td></td>
    </tr>
    <tr>
      <td>Astreinte</td>
      <td></td>
      <td></td>
      <td></td>
    </tr>
    <tr class="no-border">
      <td></td>
      <td colspan="2" class="merged">Valeur total HT</td>
      <td>{{amountHT}}</td>
    </tr>
    <tr class="empty-row">
      <td></td>
      <td colspan="2"></td>
      <td></td>
    </tr>
    <tr class="no-border">
      <td></td>
      <td colspan="2" class="merged">TVA 20%</td>
      <td>{{amountTVA}}</td>
    </tr>
    <tr class="no-border">
      <td></td>
      <td colspan="2" class="merged">Total TTC</td>
      <td>{{totalTTC}}</td>
    </tr>
  </table>

</body>
</html>
