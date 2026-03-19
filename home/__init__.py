from flask import Blueprint

# Definición del Blueprint centrada para que las rutas lo importen
bp = Blueprint('home', __name__, 
               template_folder='templates', 
               static_folder='static', 
               static_url_path='/home/static')

# Importar rutas para que se registren al importar el blueprint
from .routes import home
