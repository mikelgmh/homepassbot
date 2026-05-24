start_admin =
    🏠 *HomePassBot*
    
    Usa /menu para abrir el panel de administración.
start_user =
    🏠 *HomePassBot*
    
    Comandos:
    /menu - Abrir puertas (si tienes acceso)
    /language - Cambiar idioma
not_authorized = No autorizado
cancelled = Cancelado
cancel_command = cancelar

access_request_sent =
    🔒 Tu solicitud de acceso ha sido enviada al administrador. Por favor espera.
access_pending =
    ⏳ Tu solicitud está pendiente de aprobación. Por favor espera.
access_expired_notified =
    🔒 Tu acceso ha expirado. Se ha notificado al administrador.
access_expired_contact_admin =
    🔒 Tu acceso ha expirado. Contacta con el administrador si necesitas acceso de nuevo.
access_denied_by_admin =
    ❌ El administrador ha rechazado tu solicitud de acceso.
access_removed_by_admin =
    ❌ El administrador ha eliminado tu acceso.
permission_denied_expired = ⛔ Permiso denegado o expirado
your_permission_expired = ⛔ Tu permiso ha expirado o ha sido revocado.

admin_new_user_request =
    🆕 *Nuevo usuario solicita acceso*
    
    ID: `{ $userId }`
    Nombre: { $name }
admin_user_rejected = ❌ Usuario rechazado.
admin_access_removed = Acceso eliminado
admin_access_removed_msg = ✅ Acceso eliminado para ID `{ $userId }`.
admin_user_rehabilitated = 🗑️ { $name } eliminado del sistema.
admin_user_rehabilitated_hint = Puede solicitar acceso de nuevo escribiendo al bot.
admin_panel_title = 📋 Panel de Administración
admin_no_users = 📋 No hay usuarios registrados.
admin_no_active_users = ❌ No hay usuarios con permiso activo.
admin_no_pending = ✅ No hay solicitudes pendientes.
admin_no_denied = ✅ No hay usuarios denegados.
admin_select_user_remove = ❌ *Seleccione usuario para eliminar:*
admin_select_user_change_time = 🔄 *Seleccione usuario para cambiar hora:*
admin_enter_user_id =
    Introduce el ID numérico del usuario de Telegram que quieres añadir, o escribe "{ $cancel }":
admin_enter_expiry_date =
    ¿Hasta qué fecha y hora le doy permiso a *{ $name }*?
    
    Formato: `DD/MM/YYYY HH:MM`
    Ejemplo: 25/12/2025 18:30
    
    Escriba "{ $cancel }" para cancelar.
admin_current_expiry = *{ $name }* tiene acceso hasta: { $expiry }
admin_enter_new_date =
    Introduce la nueva fecha y hora (formato: `DD/MM/YYYY HH:MM`) o escriba "{ $cancel }":
admin_select_doors =
    📅 Fecha: { $date }
    
    Selecciona a qué entidades puede acceder *{ $name }*:
admin_permission_granted =
    ✅ Permiso concedido a *{ $name }* ({ $doors }) hasta el { $date }.
admin_permission_updated =
    ✅ Permiso actualizado para *{ $name }* ({ $doors }) hasta el { $date }.
admin_user_notification_granted =
    ✅ El administrador te ha concedido acceso a: { $doors }
    
    Válido hasta el { $date }.
    Selecciona una opción:
admin_user_notification_updated =
    ✅ El administrador te ha actualizado el acceso a: { $doors }
    
    Válido hasta el { $date }.
    Selecciona una opción:
admin_user_already_exists =
    El usuario { $id } ya existe con estado: { $status }. Puedes cambiar su acceso desde el menú.
admin_user_added =
    ✅ Usuario { $id } añadido con estado "pendiente". Usa el menú para aprobarlo.
admin_user_not_found = Usuario no encontrado
admin_user_not_pending = Este usuario no está en estado pendiente.
admin_rehabilitated = Usuario rehabilitado
admin_user_expired =
    🔒 El acceso de *{ $name }* (`{ $id }`) ha expirado.
admin_pending_title =
    ⏳ Solicitudes pendientes ({ $count }):
    
    { $list }
admin_denied_title =
    ❌ Usuarios denegados ({ $count }):
    
    { $list }
admin_users_list_title = 📋 *Usuarios registrados:*
admin_time_remaining_title = ⏱ *Tiempo restante:*
admin_back = 🔙 Volver
admin_accept = ✅ Aceptar
admin_reject = ❌ Rechazar

door_opening = ⏳ Abriendo { $door }...
door_opened = ✅ { $door } abierta.
door_error = ❌ Error al abrir { $door }: { $error }
door_ha_warning =
    ✅ Solicitud enviada a { $door } (HA respondió con advertencia, pero debería haberse abierto).
door_yes_abrir = ✅ Sí, abrir
door_no = ❌ No
select_option_prompt = Selecciona una opción:

time_server = Servidor: { $time }
time_remaining_never = Sin límite
time_remaining_expires = Nunca
time_remaining_expired = Expirado
time_remaining_label = ⌛ { $time }
time_expires_label = 📅 Expira: { $date }

command_no_permission = ❌ No tienes permiso para usar este comando.
menu_list_users = 📋 Usuarios con permiso
menu_remaining_time = ⏱ Tiempo restante
menu_remove_user = ❌ Eliminar acceso
menu_add_user = ➕ Añadir usuario
menu_change_time = 🔄 Cambiar hora de acceso
menu_pending_requests = ⏳ Pendientes
menu_denied_users = ❌ Denegados
menu_restore_user = Restaurar
menu_manage_entities = 🏗️ Entidades
menu_language = 🌐 Idioma
menu_requests_enabled = ✅ Solicitudes activadas
menu_requests_disabled = ❌ Solicitudes desactivadas
requests_enabled_now = ✅ Las solicitudes de nuevos usuarios ahora están activadas.
requests_disabled_now = ❌ Las solicitudes de nuevos usuarios ahora están desactivadas.
access_requests_disabled = ❌ El administrador no está aceptando nuevas solicitudes de acceso en este momento.
menu_discover_entities = 🔍 Descubrir desde HA
menu_add_entity_manual = ➕ Añadir manual
menu_delete_entity = 🗑️ Eliminar entidad
menu_sync_names = 🔄 Sincronizar nombres
callback_syncing = Sincronizando nombres desde Home Assistant...
sync_names_done = ✅ { $count } nombre(s) de entidad sincronizado(s).

entity_not_found = Entidad no encontrada
entity_confirm_open = ¿Estás seguro de que quieres abrir *{ $name }*?
entity_list_title = 🏗️ *Entidades*
entity_list_empty = Aún no hay entidades configuradas.
entity_delete_title = 🗑️ *Selecciona entidad a eliminar:*
discover_searching = 🔍 Buscando entidades en Home Assistant...
discover_none = No se encontraron entidades compatibles.
discover_all_added = Todas las entidades descubiertas ya están añadidas.
discover_title = 🔍 *Entidades descubiertas ({ $count }):*
select_entities_title = Selecciona a qué entidades puede acceder este usuario:
select_entities_none = Selecciona al menos una entidad.
confirm_selection = ✅ Confirmar
prompt_entity_id = Envía el ID de la entidad de Home Assistant (ej. `button.my_button`):
prompt_entity_invalid_domain = Dominio no soportado: `{ $domain }`. Aceptados: button, lock, switch, cover, scene, automation, input_boolean.
prompt_entity_exists = Esta entidad ya está en la lista.
callback_entity_added = ✅ Entidad añadida
callback_entity_removed = ❌ Entidad eliminada

callback_authorizing = Configurando permiso...
callback_rejected = Usuario rechazado
callback_removed = Acceso eliminado
callback_rehabilitated = Usuario eliminado
callback_changing_time = Cambiando hora...
callback_not_authorized = No autorizado
callback_user_not_found = Usuario no encontrado
callback_cancelled = Cancelado
callback_invalid_action = Acción no válida
callback_saved = Permiso guardado

input_invalid_format =
    Formato inválido. Use `DD/MM/YYYY HH:MM`
    Ejemplo: 25/12/2025 18:30
    
    Escriba "{ $cancel }" para cancelar.
input_invalid_date = Fecha inválida. Intente de nuevo:
input_date_must_be_future = La fecha debe ser futura. Intente de nuevo:
input_invalid_id = ID inválido. Introduce un número de Telegram ID.
input_operation_cancelled = Operación cancelada.

language_select = Selecciona tu idioma / Select your language:
language_changed_es = ✅ Idioma cambiado a español.
language_changed_en = ✅ Language changed to English.
language_button_es = 🇪🇸 Español
language_button_en = 🇬🇧 English

menu_manage_pins = 🔑 Gestionar PINs
pin_management_title = 🔑 *Gestionar PINs*
pin_enter_code =
    Introduce un PIN de 4-6 dígitos para *{ $name }*, o escribe "{ $cancel }":
pin_set_msg = ✅ PIN establecido correctamente.
pin_removed_msg = ❌ PIN eliminado.
callback_pin_removed = PIN eliminado
callback_enter_pin = Introduce PIN para el usuario
