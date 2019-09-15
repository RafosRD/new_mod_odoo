odoo.define('pos_ncf_manager.models', function (require) {
    "use strict";

    var models = require('point_of_sale.models');
    var SuperOrder = models.Order;

    models.load_fields('res.partner', ['sale_fiscal_type']);
    models.load_fields('pos.config', ['default_partner_id','invoice_journal_sequence_id','special_fiscal_position_id']);
    models.load_fields('pos.order',['move_name','origin_move_name','ncf_expiration_date']);

    models.load_models({
        model: 'res.partner',
        fields: ['partner_id', 'sale_fiscal_type'],
        loaded: function (self) {

            self.sale_fiscal_type = [
                {"code": "consumo", "name": "Factura de Consumo"},
                {"code": "credito", "name": "Factura de Crédito"},
                {"code": "gubernamental", "name": "Factura Gubernamental"},
                {"code": "tributacion", "name": "Regímenes Especiales"}];

        },
    });

    models.load_models({
        model:  'ir.sequence.date_range',
        fields: ['number_next', 'max_number_next', 'date_to', 'sale_fiscal_type'],
        domain: function(self){
            return [['sequence_id','=',self.config.invoice_journal_sequence_id[0]]]; },
        loaded: function(self,sequences){
            self.db.set_ncf_sequences(sequences);

        },
    });

    models.load_models({
        model:  'ir.sequence',
        fields: ['prefix', 'padding'],
        domain: function(self){
            return [['id','=',self.config.invoice_journal_sequence_id[0]]]; },
        loaded: function(self,sequence){

            self.db.set_journal_sequence(sequence);

        },
    });

    models.Order = models.Order.extend({
        initialize: function (attributes, options) {
            var self = this;
			self.move_name = '';
			self.origin_move_name = '';
			self.ncf_expiration_date = '';
			self.fiscal_type_name = '';
            SuperOrder.prototype.initialize.call(this, attributes, options);
            if (!self.get_client()) {
                var default_partner_id = self.pos.db.get_partner_by_id(self.pos.config.default_partner_id[0]);
                self.set_client(default_partner_id);
            }
        },
        export_as_JSON: function() {
			var self = this;
			var loaded=SuperOrder.prototype.export_as_JSON.call(this);
			var current_order = self.pos.get_order();
			if(self.pos.get_order()){
                loaded.origin_move_name = current_order.origin_move_name;
                loaded.move_name = current_order.move_name;
                loaded.ncf_expiration_date = current_order.ncf_expiration_date;
                loaded.fiscal_type_name = current_order.fiscal_type_name;
            }


			return loaded;
		},
    });


});



