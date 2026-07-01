use tauri::menu::{MenuBuilder, MenuEvent, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};
use tauri::{AppHandle, Emitter, Manager, WebviewWindow};
use tauri_plugin_deep_link::DeepLinkExt;
use tauri_plugin_opener::OpenerExt;

const APP_URL: &str = "https://estala-project-manager.vercel.app";
const API_URL: &str = "https://estala-project-manager.vercel.app/api/projects";
const DEEP_LINK_EVENT: &str = "desktop-deep-link";

fn navigate_main_window(window: &WebviewWindow, target: &str) {
  if let Ok(url) = target.parse() {
    let _ = window.navigate(url);
  }
}

fn deep_link_to_url(raw: &str) -> String {
  let trimmed = raw.trim();

  if let Some(path) = trimmed.strip_prefix("estalapm://project/") {
    let mut parts = path.split('?');
    let project_id = parts.next().unwrap_or_default().trim_matches('/');
    let query = parts.next().unwrap_or_default();

    if project_id.is_empty() {
      return APP_URL.to_string();
    }

    if query.is_empty() {
      return format!("{APP_URL}/?project={project_id}");
    }

    return format!("{APP_URL}/?project={project_id}&{query}");
  }

  APP_URL.to_string()
}

fn handle_deep_link(app: &AppHandle, raw: &str) {
  let target = deep_link_to_url(raw);

  if let Some(window) = app.get_webview_window("main") {
    let _ = window.set_focus();
    navigate_main_window(&window, &target);
  }

  let _ = app.emit(DEEP_LINK_EVENT, target);
}

fn build_menu(app: &AppHandle) -> tauri::Result<tauri::menu::Menu<tauri::Wry>> {
  let open_workspace = MenuItemBuilder::with_id("open-workspace", "Open Workspace")
    .accelerator("CmdOrCtrl+1")
    .build(app)?;
  let open_launch = MenuItemBuilder::with_id("open-launch", "Summer Launch")
    .accelerator("CmdOrCtrl+2")
    .build(app)?;
  let open_ops = MenuItemBuilder::with_id("open-ops", "Client Ops Hub")
    .accelerator("CmdOrCtrl+3")
    .build(app)?;
  let open_web = MenuItemBuilder::with_id("open-web", "Open Web App in Browser").build(app)?;
  let open_api = MenuItemBuilder::with_id("open-api", "Open Projects API").build(app)?;
  let reload = MenuItemBuilder::with_id("reload", "Reload").accelerator("CmdOrCtrl+R").build(app)?;
  let fullscreen = MenuItemBuilder::with_id("fullscreen", "Toggle Full Screen")
    .accelerator("Ctrl+Cmd+F")
    .build(app)?;

  let app_submenu = SubmenuBuilder::new(app, "Estala PM")
    .item(&open_workspace)
    .item(&open_launch)
    .item(&open_ops)
    .separator()
    .item(&open_web)
    .item(&open_api)
    .separator()
    .item(&PredefinedMenuItem::quit(app, None)?)
    .build()?;

  let view_submenu = SubmenuBuilder::new(app, "View")
    .item(&reload)
    .item(&fullscreen)
    .build()?;

  MenuBuilder::new(app)
    .item(&app_submenu)
    .item(&view_submenu)
    .build()
}

fn on_menu_event(app: &AppHandle, event: MenuEvent) {
  let Some(window) = app.get_webview_window("main") else {
    return;
  };

  match event.id().0.as_str() {
    "open-workspace" => navigate_main_window(&window, APP_URL),
    "open-launch" => navigate_main_window(&window, &format!("{APP_URL}/?project=launch")),
    "open-ops" => navigate_main_window(&window, &format!("{APP_URL}/?project=ops")),
    "open-web" => {
      let _ = app.opener().open_url(APP_URL, None::<&str>);
    }
    "open-api" => {
      let _ = app.opener().open_url(API_URL, None::<&str>);
    }
    "reload" => {
      let _ = window.eval("window.location.reload();");
    }
    "fullscreen" => {
      let _ = window.set_fullscreen(!window.is_fullscreen().unwrap_or(false));
    }
    _ => {}
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_window_state::Builder::new().build())
    .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
      if let Some(arg) = args.iter().find(|arg| arg.starts_with("estalapm://")) {
        handle_deep_link(app, arg);
        return;
      }

      if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
      }
    }))
    .plugin(tauri_plugin_deep_link::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      let menu = build_menu(app.handle())?;
      app.set_menu(menu)?;
      app.on_menu_event(on_menu_event);

      if let Some(window) = app.get_webview_window("main") {
        if cfg!(not(debug_assertions)) {
          navigate_main_window(&window, APP_URL);
        }
      }

      #[cfg(desktop)]
      {
        if let Ok(Some(current)) = app.deep_link().get_current() {
          for url in current {
            handle_deep_link(app.handle(), url.as_str());
          }
        }

        let app_handle = app.handle().clone();
        app.deep_link().on_open_url(move |event| {
          for url in event.urls() {
            handle_deep_link(&app_handle, url.as_str());
          }
        });
      }

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
