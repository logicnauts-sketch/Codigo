from flask import Blueprint

bp = Blueprint('productos', __name__,
               template_folder='templates',
               static_folder='static',
               static_url_path='/productos/static')

from .routes import productos
