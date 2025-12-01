import psycopg2

try:
    conn = psycopg2.connect(
        dbname="storage",
        user="postgres",
        password="0000",
        host="localhost",
        port="5432"
    )
    print(" Connexion PostgreSQL réussie !")
    conn.close()
except Exception as e:
    print("Erreur de connexion :", e)
