start_admin =
    🏠 *Home Unlock Bot*
    
    Use /menu to open the admin panel.
start_user =
    🏠 *Home Unlock Bot*
    
    Commands:
    /menu - Open doors (if you have access)
    /language - Change language
not_authorized = Not authorized
cancelled = Cancelled
cancel_command = cancel

access_request_sent =
    🔒 Your access request has been sent to the administrator. Please wait.
access_pending =
    ⏳ Your request is pending approval. Please wait.
access_expired_notified =
    🔒 Your access has expired. The administrator has been notified.
access_expired_contact_admin =
    🔒 Your access has expired. Contact the administrator if you need access again.
access_denied_by_admin =
    ❌ The administrator has rejected your access request.
access_removed_by_admin =
    ❌ The administrator has removed your access.
permission_denied_expired = ⛔ Permission denied or expired
your_permission_expired = ⛔ Your permission has expired or been revoked.

admin_new_user_request =
    🆕 *New user requests access*
    
    ID: `{ $userId }`
    Name: { $name }
admin_user_rejected = ❌ User rejected.
admin_access_removed = Access removed
admin_access_removed_msg = ✅ Access removed for ID `{ $userId }`.
admin_user_rehabilitated = 🗑️ { $name } has been removed from the system.
admin_user_rehabilitated_hint = They can request access again by messaging the bot.
admin_panel_title = 📋 Admin Panel
admin_no_users = 📋 No registered users.
admin_no_active_users = ❌ No users with active permission.
admin_no_pending = ✅ No pending requests.
admin_no_denied = ✅ No denied users.
admin_select_user_remove = ❌ *Select user to remove:*
admin_select_user_change_time = 🔄 *Select user to change time:*
admin_enter_user_id =
    Enter the numeric Telegram ID of the user you want to add, or type "{ $cancel }":
admin_enter_expiry_date =
    Until what date and time should I grant permission to *{ $name }*?
    
    Format: `DD/MM/YYYY HH:MM`
    Example: 25/12/2025 18:30
    
    Type "{ $cancel }" to cancel.
admin_current_expiry = *{ $name }* currently has access until: { $expiry }
admin_enter_new_date =
    Enter the new date and time (format: `DD/MM/YYYY HH:MM`) or type "{ $cancel }":
admin_select_doors =
    📅 Date: { $date }
    
    Select which entities *{ $name }* can access:
admin_permission_granted =
    ✅ Permission granted to *{ $name }* ({ $doors }) until { $date }.
admin_permission_updated =
    ✅ Permission updated for *{ $name }* ({ $doors }) until { $date }.
admin_user_notification_granted =
    ✅ The administrator has granted you access to: { $doors }
    
    Valid until { $date }.
    Select an option:
admin_user_notification_updated =
    ✅ The administrator has updated your access to: { $doors }
    
    Valid until { $date }.
    Select an option:
admin_user_already_exists =
    User { $id } already exists with status: { $status }. You can change their access from the menu.
admin_user_added =
    ✅ User { $id } added with status "pending". Use the menu to approve them.
admin_user_not_found = User not found
admin_user_not_pending = This user is not in pending status.
admin_rehabilitated = User rehabilitated
admin_user_expired =
    🔒 *{ $name }*'s (`{ $id }`) access has expired.
admin_pending_title =
    ⏳ Pending requests ({ $count }):
    
    { $list }
admin_denied_title =
    ❌ Denied users ({ $count }):
    
    { $list }
admin_users_list_title = 📋 *Registered users:*
admin_time_remaining_title = ⏱ *Time remaining:*
admin_back = 🔙 Back
admin_accept = ✅ Accept
admin_reject = ❌ Reject

door_opening = ⏳ Opening { $door }...
door_opened = ✅ { $door } opened.
door_error = ❌ Error opening { $door }: { $error }
door_ha_warning =
    ✅ Request sent to { $door } (HA responded with a warning, but it should have opened).
door_yes_abrir = ✅ Yes, open
door_no = ❌ No
select_option_prompt = Select an option:

time_server = Server: { $time }
time_remaining_never = Unlimited
time_remaining_expires = Never
time_remaining_expired = Expired
time_remaining_label = ⌛ { $time }
time_expires_label = 📅 Expires: { $date }

command_no_permission = ❌ You do not have permission to use this command.
menu_list_users = 📋 Users with permission
menu_remaining_time = ⏱ Remaining time
menu_remove_user = ❌ Remove access
menu_add_user = ➕ Add user
menu_change_time = 🔄 Change access time
menu_pending_requests = ⏳ Pending
menu_denied_users = ❌ Denied
menu_restore_user = Restore
menu_manage_entities = 🏗️ Entities
menu_language = 🌐 Language
menu_requests_enabled = ✅ Requests enabled
menu_requests_disabled = ❌ Requests disabled
requests_enabled_now = ✅ New user requests are now enabled.
requests_disabled_now = ❌ New user requests are now disabled.
access_requests_disabled = ❌ The administrator is not accepting new access requests at this time.
menu_discover_entities = 🔍 Discover from HA
menu_add_entity_manual = ➕ Add manually
menu_delete_entity = 🗑️ Delete entity
menu_sync_names = 🔄 Sync names
callback_syncing = Syncing names from Home Assistant...
sync_names_done = ✅ Synchronized { $count } entity name(s).

entity_not_found = Entity not found
entity_confirm_open = Are you sure you want to open *{ $name }*?
entity_list_title = 🏗️ *Entities*
entity_list_empty = No entities configured yet.
entity_delete_title = 🗑️ *Select entity to delete:*
discover_searching = 🔍 Searching for entities in Home Assistant...
discover_none = No compatible entities found.
discover_all_added = All discovered entities have already been added.
discover_title = 🔍 *Discovered entities ({ $count }):*
select_entities_title = Select which entities this user can access:
select_entities_none = Select at least one entity.
confirm_selection = ✅ Confirm
prompt_entity_id = Send the entity ID from Home Assistant (e.g. `button.my_button`):
prompt_entity_invalid_domain = Unsupported domain: `{ $domain }`. Accepted: button, lock, switch, cover, scene, automation, input_boolean.
prompt_entity_exists = This entity is already in the list.
callback_entity_added = ✅ Entity added
callback_entity_removed = ❌ Entity removed

callback_authorizing = Setting permission...
callback_rejected = User rejected
callback_removed = Access removed
callback_rehabilitated = User removed
callback_changing_time = Changing time...
callback_not_authorized = Not authorized
callback_user_not_found = User not found
callback_cancelled = Cancelled
callback_invalid_action = Invalid action
callback_saved = Permission saved

input_invalid_format =
    Invalid format. Use `DD/MM/YYYY HH:MM`
    Example: 25/12/2025 18:30
    
    Type "{ $cancel }" to cancel.
input_invalid_date = Invalid date. Try again:
input_date_must_be_future = The date must be in the future. Try again:
input_invalid_id = Invalid ID. Enter a Telegram numeric ID.
input_operation_cancelled = Operation cancelled.

language_select = Select your language / Selecciona tu idioma:
language_changed_es = ✅ Idioma cambiado a español.
language_changed_en = ✅ Language changed to English.
language_button_es = 🇪🇸 Español
language_button_en = 🇬🇧 English
