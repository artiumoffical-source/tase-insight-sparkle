ALTER TABLE tase_symbols ADD COLUMN IF NOT EXISTS reporting_currency TEXT DEFAULT 'ILS';

UPDATE tase_symbols SET reporting_currency = 'USD'
WHERE ticker IN ('TEVA','ICL','NICE','ESLT','KMDA','SPNS','ARBE','ENLT','TSEM','CNFN');