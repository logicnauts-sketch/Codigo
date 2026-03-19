from flask import Blueprint

bp = Blueprint('inventario', __name__,
               template_folder='templates',
               static_folder='static',
               static_url_path='/inventario/static')

from .routes import inventario
