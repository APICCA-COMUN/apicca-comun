// Plantilla del correo de restablecer contraseña (RF-12 (002), RNF-3 (002), D-T15 (002)).
// Pura: devuelve texto con los marcadores que Firebase Auth reemplaza (%LINK%, %EMAIL%, %APP_NAME%).
// Todo el material visual sale de apicca.com (D-21 (002)) y los colores, de TOKENS.light.
import { TOKENS } from './tokens';

export interface ResetEmail {
  senderName: string;
  subject: string;
  body: string;
}

const LOGO_URL = 'https://apicca.com/brand/logo.png';

export function resetEmail(): ResetEmail {
  const c = TOKENS.light;
  const font = "'Nunito', 'Trebuchet MS', Arial, sans-serif";
  const body = `<!doctype html>
<html lang="es" style="color-scheme: light only;">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>Restablece tu contraseña</title>
</head>
<body bgcolor="${c.background}" style="margin: 0; padding: 0; background-color: ${c.background}; color: ${c.text}; color-scheme: light only; font-family: ${font};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${c.background}" style="background-color: ${c.background};">
<tr><td align="center" style="padding: 24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${c.surface}" style="max-width: 480px; background-color: ${c.surface}; color: ${c.text}; border-radius: ${c['radius-block']};">
<tr><td align="center" style="padding: 24px 24px 8px;">
<img src="${LOGO_URL}" alt="APICCA COMÚN" width="160" style="display: block; max-width: 100%; height: auto; border: 0;">
</td></tr>
<tr><td style="padding: 8px 24px 24px; color: ${c.text}; font-family: ${font}; font-size: 16px; line-height: 1.5;">
<h1 style="margin: 0 0 16px; font-size: 22px; color: ${c.text};">Restablece tu contraseña</h1>
<p style="margin: 0 0 16px;">Hola. Recibimos una solicitud para restablecer tu contraseña en %APP_NAME%.</p>
<p style="margin: 0 0 16px; word-break: break-word; color: ${c['text-muted']};">Cuenta: %EMAIL%</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 16px;">
<tr><td bgcolor="${c['action-blue']}" style="background-color: ${c['action-blue']}; border-radius: ${c['radius-block']};">
<a href="%LINK%" style="display: inline-block; padding: 12px 20px; color: ${c['on-accent']}; font-weight: bold; text-decoration: none;">Elegir una contraseña nueva</a>
</td></tr>
</table>
<p style="margin: 0 0 16px; color: ${c['text-muted']};">Si no pediste este cambio, puedes ignorar este correo: tu contraseña seguirá igual.</p>
<p style="margin: 0; color: ${c['text-muted']};">Gracias por cuidar lo común. — APICCA COMÚN</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>
`;
  return {
    senderName: 'APICCA COMÚN',
    subject: 'Restablece tu contraseña de %APP_NAME%',
    body,
  };
}
