import { Client, Databases } from 'appwrite';

export default async ({ req, res }) => {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT || 'https://fra.cloud.appwrite.io/v1')
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

  const databases = new Databases(client);
  const DATABASE_ID = process.env.APPWRITE_DATABASE_ID;

  if (req.method === 'GET') {
    const { collection } = req.query;
    try {
      const response = await databases.listDocuments(DATABASE_ID, collection, []);
      return res.json(response.documents.map(d => ({ ...d, id: d.$id })));
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method === 'POST') {
    const { collection, documentId, data } = req.body;
    try {
      const response = await databases.createDocument(DATABASE_ID, collection, documentId, data);
      return res.json({ ...response, id: response.$id });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method === 'PUT') {
    const { collection, documentId, data } = req.body;
    try {
      const response = await databases.updateDocument(DATABASE_ID, collection, documentId, data);
      return res.json({ ...response, id: response.$id });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method === 'DELETE') {
    const { collection, documentId } = req.body;
    try {
      await databases.deleteDocument(DATABASE_ID, collection, documentId);
      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};