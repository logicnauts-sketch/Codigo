from flask import Blueprint

bp = Blueprint('gastos_diarios', __name__, 
              template_folder='templates',
              static_folder='static')

from .routes.routes import *
