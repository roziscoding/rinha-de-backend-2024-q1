CREATE TABLE IF NOT EXISTS rinhadebackend.client (
    id INT PRIMARY KEY,
    credit_limit INT NOT NULL,
    balance INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS rinhadebackend.transaction (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    valor INT NOT NULL,
    tipo VARCHAR(1) NOT NULL,
    descricao VARCHAR(255) NOT NULL,
    realizada_em TIMESTAMP NOT NULL DEFAULT now(),
    client_id INT NOT NULL,
    FOREIGN KEY (client_id) REFERENCES client(id)
);

BEGIN;
  INSERT INTO rinhadebackend.client (id, credit_limit)
  VALUES
    (1, 1000 * 100),
    (2, 800 * 100),
    (3, 10000 * 100),
    (4, 100000 * 100),
    (5, 5000 * 100);
COMMIT;