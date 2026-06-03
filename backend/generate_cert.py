"""
Generate a self-signed SSL certificate for HTTPS development.

Usage:
    python generate_cert.py

Generates cert.pem and key.pem in the current directory.
"""

import os
import subprocess
import sys

def generate_cert():
    cert_file = os.path.join(os.path.dirname(__file__), 'cert.pem')
    key_file = os.path.join(os.path.dirname(__file__), 'key.pem')
    
    if os.path.exists(cert_file) and os.path.exists(key_file):
        print("SSL certificates already exist. Delete them first to regenerate.")
        return
    
    print("Generating self-signed SSL certificate...")
    
    try:
        subprocess.run([
            'openssl', 'req', '-x509', '-newkey', 'rsa:4096',
            '-keyout', key_file,
            '-out', cert_file,
            '-days', '365',
            '-nodes',  # No passphrase
            '-subj', '/CN=localhost/O=ServiceBook/C=RO',
            '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1,IP:0.0.0.0'
        ], check=True, capture_output=True)
        
        print(f"Certificate generated successfully!")
        print(f"  cert.pem: {cert_file}")
        print(f"  key.pem:  {key_file}")
        print(f"")
        print(f"You can now start the server with: python app.py")
        print(f"Access via: https://localhost:5001")
    except FileNotFoundError:
        print("Error: 'openssl' command not found. Please install OpenSSL.")
        sys.exit(1)
    except subprocess.CalledProcessError as e:
        print(f"Error generating certificate: {e.stderr.decode()}")
        sys.exit(1)

if __name__ == '__main__':
    generate_cert()
