"""SlowAPI limiter shared across routers."""  # FIXED: S3
from slowapi import Limiter  # FIXED: S3
from slowapi.util import get_remote_address  # FIXED: S3

limiter = Limiter(key_func=get_remote_address)  # FIXED: S3
