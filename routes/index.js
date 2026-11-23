const express = require('express');
const dashboard = require('../controllers/dashboardController');
const tickets = require('../controllers/ticketController');
const comments = require('../controllers/commentController');
const technicians = require('../controllers/technicianController');
const categories = require('../controllers/categoryController');

const router = express.Router();

// Home
router.get('/', (req, res) => res.render('home', { title: 'HelpDesk TI' }));

// Dashboard
router.get('/dashboard', dashboard.index);

// Chamados
router.get('/tickets', (req, res) => res.render('tickets/index', { title: 'Chamados' }));
router.get('/tickets/new', (req, res) => res.render('tickets/form', { title: 'Novo Chamado' }));
router.get('/tickets/novo', (req, res) => res.render('tickets/form', { title: 'Novo Chamado' }));
router.get('/tickets/:id', (req, res) => res.render('tickets/show', { title: 'Detalhes do Chamado' }));

// Gestão de Usuários (Apenas Admin)
router.get('/usuarios', (req, res) => res.render('users/index', { title: 'Gestão de Usuários' }));

// Técnicos
router.get('/technicians', technicians.index);
router.get('/technicians/new', technicians.new);
router.post('/technicians', technicians.create);
router.get('/technicians/:id/edit', technicians.edit);
router.put('/technicians/:id', technicians.update);
router.delete('/technicians/:id', technicians.destroy);

// Categorias
router.get('/categories', categories.index);
router.get('/categories/new', categories.new);
router.post('/categories', categories.create);
router.get('/categories/:id/edit', categories.edit);
router.put('/categories/:id', categories.update);
router.delete('/categories/:id', categories.destroy);

module.exports = router;
