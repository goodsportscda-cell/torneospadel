# Contacto y privacidad — 28 de septiembre de 2026

## Implementado

- Soporte de Padel ID: WhatsApp +54 9 11 6594-2709. No se creó ni se inventó un email.
- Responsable informada: Anamaria Quiroga Fernández, persona física; alcance inicial Argentina.
- Página `/ayuda`, enlaces en inicio, acceso, panel del jugador, panel de administración y pies públicos.
- WhatsApp y email públicos por club, editables desde Configuración. Vacíos por defecto: no se copian teléfonos de jugadores ni del personal. Un canal vacío no se muestra.
- Migración `club_public_contacts` aplicada al proyecto usado por `.env`, `okmmwahmhxuyojdtksnr`. `supabase/config.toml` conserva una referencia histórica distinta; no usar ese archivo para elegir el destino de un despliegue sin verificarlo.
- Avisos informativos en alta de cuenta, formulario público de inscripción y edición de ficha del jugador.
- Borradores de privacidad, términos y almacenamiento del navegador, identificados como tales. No se agregaron casillas de aceptación ni se registra consentimiento sobre textos incompletos.
- No se desplegó el frontend.

## Información pendiente para finalizar los textos

1. Domicilio de contacto del responsable, solicitado a la titular. No publicar un domicilio supuesto.
2. Email de soporte cuando exista.
3. Plazos concretos de conservación, incluyendo comprobantes, cuentas inactivas, historial y copias de respaldo; procedimiento real de supresión y atención de solicitudes.
4. Verificar proveedores, subencargados, alojamiento y garantías para transferencias internacionales. La región de la base de datos consultada es `sa-east-1` (Brasil), por lo que no debe describirse el alojamiento como exclusivamente argentino.
5. Acordar el papel de Padel ID y de cada organizador respecto de los datos; considerar inscripciones de menores y datos aportados por compañeros.
6. Con el texto definitivo, definir base de tratamiento para cada finalidad y, donde corresponda, aceptación expresa con registro en servidor de versión, fecha y actor. Cubrir inscripción en parejas, inscripción individual pública y la inscripción rápida del panel; una casilla visual o user_metadata editable no constituyen por sí solos un registro íntegro.

## Verificación y límites

- Build de producción correcto; advertencia de tamaño de chunks.
- Tres pruebas de normalización y generación segura de enlaces WhatsApp correctas.
- RLS de clubes activa; política de edición restringida a authenticated con USING y WITH CHECK por club/superadmin.
- Consultas con rollback: anon y un usuario sin membresía no pudieron actualizar contactos.
- La edición como superadmin se verificó con rollback. No hay perfiles de administrador de club en el proyecto para verificar esa rama con un usuario existente.
- Revisión en navegador de ayuda y privacidad; lint de los nuevos componentes sin errores.
- El chequeo global de TypeScript falla en módulos ajenos a los nuevos componentes (entre ellos StaffManager, PlayerInscriptions, TorneoIndividualDashboard y Torneos). No es un chequeo global limpio.
- El asesor de seguridad de Supabase detecta avisos sobre vistas SECURITY DEFINER, funciones ejecutables con privilegios elevados, search_path mutable y protección de contraseñas filtradas desactivada. Son hallazgos que requieren evaluación: este cambio no agregó esas vistas ni funciones y no demuestra por sí solo que un dato esté expuesto.
- No se completó una auditoría integral de acceso a DNI, teléfonos y comprobantes. Verificar grants, RLS, vistas públicas, funciones de búsqueda, vinculación de fichas y almacenamiento antes de afirmar confidencialidad garantizada.

Referencias: [Ley 25.326](https://www.argentina.gob.ar/normativa/nacional/64790/actualizacion), [AAIP](https://www.argentina.gob.ar/aaip/datospersonales/derechos), [vistas con privilegios del propietario](https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view), [seguridad de contraseñas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
