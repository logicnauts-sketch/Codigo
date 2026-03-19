from flask import Blueprint

bp = Blueprint('trabajos_pendientes', __name__, 
              template_folder='templates',
              static_folder='static')

from .routes.routes import *
