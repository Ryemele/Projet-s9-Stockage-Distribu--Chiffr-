# hsm.py

import uuid

class HSM:
    def __init__(self):
        self.keys = {}  # {file_id: encryption_key}

    def generate_key(self):
        """Simule la génération d'une clé par le HSM."""
        key = uuid.uuid4().hex
        return key

    def store_key(self, file_id, key):
        self.keys[file_id] = key

    def get_key(self, file_id):
        return self.keys.get(file_id)
