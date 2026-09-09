-- XEOMX Stage 5.3: harden the already-applied agents/workflows JSON boundary.
-- This compensating migration changes only the private recursive guard. It
-- remains trigger-only, fixed-path and uncallable by browser roles.

CREATE OR REPLACE FUNCTION private.xeomx_json_has_sensitive_key(p_value JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  v_key TEXT;
  v_normalized_key TEXT;
  v_child JSONB;
BEGIN
  IF p_value IS NULL THEN
    RETURN false;
  END IF;

  IF pg_catalog.jsonb_typeof(p_value) = 'object' THEN
    FOR v_key, v_child IN
      SELECT entry.key, entry.value
      FROM pg_catalog.jsonb_each(p_value) AS entry
    LOOP
      v_normalized_key := pg_catalog.lower(
        pg_catalog.regexp_replace(v_key, '[^a-zA-Z0-9]+', '', 'g')
      );
      IF v_normalized_key = ANY (ARRAY[
        'password', 'passwd', 'pwd',
        'secret', 'clientsecret', 'oauthsecret', 'webhooksecret', 'signingsecret',
        'token', 'accesstoken', 'refreshtoken', 'authtoken', 'bearertoken',
        'idtoken', 'sessiontoken',
        'apikey', 'providerapikey', 'clientkey',
        'servicerole', 'servicerolekey',
        'privatekey', 'signingkey', 'encryptionkey',
        'authorization', 'proxyauthorization',
        'cookie', 'setcookie',
        'credential', 'credentials', 'credentialvalue',
        'webhooksignature', 'signatureheader',
        'rawpayload', 'webhookpayload'
      ]) OR v_normalized_key ~
        '(apikey|secret|token|password|privatekey|signingkey|encryptionkey|credentialvalue|webhooksignature)$'
      THEN
        RETURN true;
      END IF;
      IF private.xeomx_json_has_sensitive_key(v_child) THEN
        RETURN true;
      END IF;
    END LOOP;
  ELSIF pg_catalog.jsonb_typeof(p_value) = 'array' THEN
    FOR v_child IN
      SELECT item.value FROM pg_catalog.jsonb_array_elements(p_value) AS item
    LOOP
      IF private.xeomx_json_has_sensitive_key(v_child) THEN
        RETURN true;
      END IF;
    END LOOP;
  END IF;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION private.xeomx_json_has_sensitive_key(JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.xeomx_json_has_sensitive_key(JSONB)
  TO service_role;

COMMENT ON FUNCTION private.xeomx_json_has_sensitive_key(JSONB) IS
  'Recursive normalized-key credential guard for agents, workflows and controlled runs.';
