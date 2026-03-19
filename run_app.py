import os
import sys
import webbrowser
import threading
import logging
import traceback
from time import sleep
import threading
from app import app
import pystray
from PIL import Image, ImageDraw

def save_crash_report(error_text):
    """Guarda un reporte de error fatal en la carpeta de la App."""
    try:
        data_dir = os.path.join(os.environ.get('LOCALAPPDATA', os.path.expanduser('~')), 'NextDesign')
        os.makedirs(data_dir, exist_ok=True)
        report_file = os.path.join(data_dir, "CRASH_REPORT_LAST.txt")
        with open(report_file, "w", encoding='utf-8') as f:
            f.write(error_text)
    except:
        pass

# Configuración de Logging para captura de errores en el EXE
def setup_logging():
    if getattr(sys, 'frozen', False):
        # En producción usamos Local AppData
        data_dir = os.path.join(os.environ.get('LOCALAPPDATA', os.path.expanduser('~')), 'NextDesign')
        log_dir = os.path.join(data_dir, 'logs')
    else:
        # En desarrollo usamos la carpeta actual
        log_dir = os.path.abspath("logs")
    
    if not os.path.exists(log_dir):
        os.makedirs(log_dir, exist_ok=True)
        
    log_file = os.path.join(log_dir, 'surti_kids_debug.log')
    
    handlers = [logging.FileHandler(log_file, encoding='utf-8')]
    
    # Solo agregar StreamHandler si hay una consola real disponible
    if sys.stdout is not None:
        handlers.append(logging.StreamHandler(sys.stdout))
    
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s [%(levelname)s] %(message)s',
        handlers=handlers
    )
    return log_file

LOG_FILE = setup_logging()
logger = logging.getLogger(__name__)

import ctypes
from ctypes import wintypes

def is_already_running():
    """Verifica si ya hay una instancia del programa corriendo usando un Mutex de Windows."""
    try:
        kernel32 = ctypes.windll.kernel32
        mutex_name = "NextDesign_SingleInstance_Mutex_v1"
        mutex = kernel32.CreateMutexW(None, False, mutex_name)
        last_error = kernel32.GetLastError()
        if last_error == 183: # ERROR_ALREADY_EXISTS
            return True
        return False
    except Exception as e:
        logger.error(f"Error comprobando instancia única: {e}")
        return False

def resource_path(relative_path):
    """ Get absolute path to resource, works for dev and for PyInstaller """
    try:
        base_path = sys._MEIPASS
    except Exception:
        base_path = os.path.abspath(".")
    return os.path.join(base_path, relative_path)

def open_browser():
    """Abre el navegador predeterminado una vez el servidor esté listo."""
    try:
        url = "http://127.0.0.1:5000"
        logger.info(f"Esperando para abrir navegador en {url}...")
        sleep(3.0) 
        webbrowser.open(url, new=1)
    except Exception as e:
        logger.error(f"Error abriendo navegador: {e}")

def quit_window(icon, item):
    logger.info("Cerrando aplicación desde el icono de bandeja...")
    icon.stop()
    os._exit(0)

def show_window(icon, item):
    webbrowser.open("http://127.0.0.1:5000")

_console_visible = False
def show_console(icon, item):
    """Abre una ventana de consola de Windows para ver logs y errores en vivo."""
    global _console_visible
    if _console_visible:
        return
    try:
        kernel32 = ctypes.windll.kernel32
        kernel32.AllocConsole()
        kernel32.SetConsoleTitleW("Next Design â€” Consola de Depuración")
        # Redirigir stdout/stderr a la nueva consola
        sys.stdout = open('CONOUT$', 'w', encoding='utf-8')
        sys.stderr = open('CONOUT$', 'w', encoding='utf-8')
        _console_visible = True
        print("â•" * 55)
        print("  NEXT DESIGN â€” Consola de Depuración")
        print("  Los errores del servidor aparecerán aquí.")
        print(f"  Archivo de log: {LOG_FILE}")
        print("â•" * 55)
        print()
        # Imprimir el contenido actual del log
        if os.path.exists(LOG_FILE):
            with open(LOG_FILE, 'r', encoding='utf-8') as f:
                lines = f.readlines()
                # Mostrar las últimas 50 líneas
                for line in lines[-50:]:
                    print(line.rstrip())
        # Re-agregar handler de logging para la nueva consola de forma segura
        root_logger = logging.getLogger()
        for h in root_logger.handlers[:]:
            if isinstance(h, logging.StreamHandler) and h.stream in [sys.stdout, sys.stderr]:
                root_logger.removeHandler(h)

        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(logging.DEBUG)
        console_handler.setFormatter(logging.Formatter('%(asctime)s [%(levelname)s] %(message)s'))
        root_logger.addHandler(console_handler)
        logger.info("Consola de depuración activada.")
    except Exception as e:
        logger.error(f"Error abriendo consola: {e}")

def open_log_file(icon, item):
    """Abre el archivo de log en el Bloc de notas."""
    try:
        if os.path.exists(LOG_FILE):
            os.startfile(LOG_FILE)
        else:
            logger.warning(f"Archivo de log no encontrado: {LOG_FILE}")
    except Exception as e:
        logger.error(f"Error abriendo log: {e}")

def create_image():
    icon_path = resource_path('static/favicon.ico')
    if os.path.exists(icon_path):
        try:
            return Image.open(icon_path)
        except Exception as e:
            logger.warn(f"No se pudo cargar favicon.ico: {e}")
            
    width = 64
    height = 64
    color1 = (59, 130, 246) # Blue Next Design
    image = Image.new('RGB', (width, height), color1)
    dc = ImageDraw.Draw(image)
    dc.rectangle((width // 4, height // 4, width * 3 // 4, height * 3 // 4), fill=(255, 255, 255))
    return image

def setup_tray():
    try:
        menu = pystray.Menu(
            pystray.MenuItem('Abrir Dashboard', show_window, default=True),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem('Ver Consola (Errores)', show_console),
            pystray.MenuItem('Abrir Archivo de Log', open_log_file),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem('Cerrar Sistema', quit_window)
        )
        icon = pystray.Icon("Next Design", create_image(), "Next Design Management", menu)
        
        # Iniciar Flask en un hilo separado con captura de errores propia
        def run_flask():
            try:
                logger.info("Iniciando Flask Server en 127.0.0.1:5000 (debug=False, threaded=True)")
                app.run(host='127.0.0.1', port=5000, debug=False, use_reloader=False, threaded=True)
            except Exception as e:
                err_msg = f"FALLO CRÃTICO EN SERVIDOR FLASK:\n{traceback.format_exc()}"
                logger.critical(err_msg)
                # Guardar crash report de emergencia
                save_crash_report(err_msg)

        flask_thread = threading.Thread(target=run_flask)
        flask_thread.daemon = True
        flask_thread.start()
        
        threading.Thread(target=open_browser).start()
        
        logger.info("Iniciando icono de bandeja del sistema...")
        icon.run()
    except Exception as e:
        logger.critical(f"FALLO CRÃTICO EN LA INTERFAZ DE BANDEJA:\n{traceback.format_exc()}")
        os._exit(1)

if __name__ == '__main__':
    try:
        logger.info("--- NEXT DESIGN INICIADO ---")
        if is_already_running():
            logger.info("Instancia duplicada detectada. Abriendo navegador y saliendo.")
            open_browser()
            sys.exit(0)
            
        setup_tray()
    except Exception as e:
        logger.critical(f"ERROR NO CONTROLADO EN MAIN:\n{traceback.format_exc()}")
        # Fallback de emergencia en AppData
        data_dir = os.path.join(os.environ.get('LOCALAPPDATA', os.path.expanduser('~')), 'NextDesign')
        os.makedirs(data_dir, exist_ok=True)
        fatal_file = os.path.join(data_dir, "FATAL_ERROR.txt")
        with open(fatal_file, "w") as f:
            f.write(traceback.format_exc())
        sys.exit(1)

