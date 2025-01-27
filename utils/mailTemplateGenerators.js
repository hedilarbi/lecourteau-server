const generateOrderConfirmationEmail = (
  name,
  code,
  type,
  address,
  total,
  items
) => {
  const date = formatDateToFrench();

  orderType = type === "delivery" ? "a livrer" : "a emporter";

  let itemsList = items.map(
    (item) =>
      `
    <p style='color:white'>${item.name} - ${item.price.toFixed(2)}$ (
      ${item.customizations?.map(
        (customization) => `<span style="color:gray"> ${customization}, </span>`
      )}  
    )</p>
  `
  );

  return ` 
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Email Template</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            background-color: #000000;
            color: black;
            font-family: Arial, sans-serif;
            line-height: 1.6;
            width: 100%;
        }
        .container {
            width: 100%;
            color:white;
            margin: 0 auto;
            padding: 20px;
            box-sizing: border-box;
              background-color: black;
        }
        .header {
            display: flex;
         
            width: 100%;
           
        }
        .header img {
            max-width: 150px;
            height: 150px;
            
        }
        .header .text {
            margin-left: auto;
            text-align: right;
            margin-top: 60px;
        }
        h1, p {
            margin: 0;
        }
       
    </style>
</head>
<body >
    <div class="container">
        <div class="header" >
            <img src="https://firebasestorage.googleapis.com/v0/b/lecourteau-19bdb.appspot.com/o/icon.png?alt=media&token=dde8431f-d60d-40d0-9fe9-403c3bce5cd2" alt="Your Image">
            <div class="text" >
               <p style='color:white'> <strong >Total:</strong> ${total} $</p>
<p style='color:white' > ${date}</p>
            </div>
        </div>
          <h1 style="margin-top:20px;font-size:32px;color:white">Merci pour votre commande, ${name}!</h1>

<p style="margin-top:20px;font-size:16px;color:white"> Votre commande ${orderType} chez Casse-croûte Courteau  été passée avec succès, votre code de commande est <strong > ${code} </strong> </p>

<p style="margin-top:20px;font-size:20px;color:white"><strong >Total:</strong> ${total} $</p>

<div style="margin-top:20px">
${itemsList}
</div>

<p style='margin-top:20px;font-size:16px;color:white'><strong >Livrer a:</strong> ${address} </p>
    </div>
 
</body>
</html>
`;
};

function formatDateToFrench() {
  const date = new Date();
  const months = [
    "janvier",
    "février",
    "mars",
    "avril",
    "mai",
    "juin",
    "juillet",
    "août",
    "septembre",
    "octobre",
    "novembre",
    "décembre",
  ];

  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();

  return `${day} ${month} ${year}`;
}

module.exports = { generateOrderConfirmationEmail };
