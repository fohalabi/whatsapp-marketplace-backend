import { Router } from 'express';
import path from 'path';
import fs from 'fs';

const router = Router();

router.get('/invoices/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(process.cwd(), 'invoices', filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Invoice not found');
  }

  res.sendFile(filePath);
});

export default router;