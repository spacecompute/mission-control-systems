c = get_config()

# Spawner
c.JupyterHub.spawner_class = 'simple'

# Authentication (development - replace with proper auth in production)
c.JupyterHub.authenticator_class = 'dummy'
c.DummyAuthenticator.password = 'password'

# Enable Real-Time Collaboration
c.Spawner.args = ['--LabApp.collaborative=True', '--allow-root']
c.Spawner.default_url = '/lab'

# Procedures directory
c.Spawner.notebook_dir = '/srv/procedures'

# Admin users
c.Authenticator.admin_users = {'admin'}

# Idle culler (1 hour timeout)
c.JupyterHub.services = [
    {
        'name': 'idle-culler',
        'command': ['python', '-m', 'jupyterhub_idle_culler', '--timeout=3600'],
        'admin': True,
    }
]

# Network
c.JupyterHub.ip = '0.0.0.0'
c.JupyterHub.port = 8000
