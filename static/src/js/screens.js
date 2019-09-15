odoo.define('pos_ncf_manager.screens', function(require) {
    "use strict";

    var core = require('web.core');
    var screens = require('point_of_sale.screens');
    var gui = require('point_of_sale.gui');
    var models = require('point_of_sale.models');
    var Model = require('web.DataModel');
    var PopupWidget = require('point_of_sale.popups');

    var SuperOrder = models.Order;
    var QWeb = core.qweb;
    var _t = core._t;


    screens.ActionpadWidget.include({
        renderElement: function () {
            this._super();
            var self = this;

            this.$('.pay').bind("click", function () {
                var client = self.pos.get_order().get_client();

                if (client === null) {
                    alert("Debe seleccionar un cliente para poder realizar el Pago, o utilizar el Cliente por defecto; de no tener un cliente por defecto, pida ayuda a su Encargado para que lo establezca.");
                    return;
                }

                if ((client.sale_fiscal_type === 'credito' || client.sale_fiscal_type === 'gubernamental' || client.sale_fiscal_type === 'triburtacion') && (client.vat === false || client.vat === null)) {
                    self.gui.show_popup('error', {
                        'title': 'Error: Para el tipo de comprobante',
                        'body': 'No puede crear una factura con crédito fiscal si el cliente no tiene RNC o Cédula. Puede pedir ayuda para que el cliente sea registrado correctamente si este desea comprobante fiscal',
                        'cancel': function () {
                            self.gui.show_screen('products');
                        }
                    });
                }

                if (self.pos.get_order().orderlines.models.length === 0) {
                    self.gui.show_popup('error', {
                        'title': 'Error: Factura sin productos',
                        'body': 'No puede pagar un ticket sin productos',
                        'cancel': function () {
                            self.gui.show_screen('products');
                        }
                    });
                }
            });
        }
    });

    screens.PaymentScreenWidget.include({

        validate_order: function (force_validation) {
            var self = this;
            var current_order = this.pos.get_order();
            var client = current_order.get_client();
            var total = current_order.get_total_with_tax();
            var partner = self.pos.db.get_partner_by_id(current_order.attributes.client.id);
            var ncf_name_dic ={
                "credito": "Factura de Crédito",
                "consumo": "Factura de Consumo",
                "gubernamental": "Factura Gubernamental",
                "tributacion": "Regímenes Especiales",
                "credit_note": "Nota de Crédito"
            };

            if (!client) {
                this.gui.show_popup('error', {
                    'title': 'Debe establecer un cliente para completar la venta.',
                    'body': 'También se puede configurar un cliente por defecto en la confguracion del TPV.'
                });
                return;
            }
            if (total == 0) {
                this.gui.show_popup('error', {
                    'title': 'Venta en 0',
                    'body': 'No puede realizar ventas en 0, favor agregar un producto con valor'
                });
                return;
            }
            if (!client.vat &&	total >= 250000.00) {
                this.gui.show_popup('error', {
                    'title': 'Esto es una venta mayor o igual a RD$ 250,000.00',
                    'body': 'Para este tipo de venta es necesario que el cliente tenga documento de identidad'
                });
                return;
            }
            var sale_fiscal_type_compare = partner.sale_fiscal_type
            if (current_order.is_return_order === true){
                sale_fiscal_type_compare = 'credit_note'
            }
            if (self.pos.db.get_ncf_next_number_aprobation(sale_fiscal_type_compare)) {
                this.gui.show_popup('error', {
                    'title': 'Secuencia agotada',
                    'body': 'La secuencia de '+ ncf_name_dic[sale_fiscal_type_compare]+' alcanzó su número máximo, favor contactar con el encargado de contabilidad para actualizar el nuevo número máximo de la secuencia de '+ ncf_name_dic[sale_fiscal_type_compare] +' en la configuración del diario '+ self.pos.config.invoice_journal_id[1]
                });
                return;
            }if (self.pos.db.get_ncf_expiration_date_aprobation(sale_fiscal_type_compare)) {
                this.gui.show_popup('error', {
                    'title': 'Secuencia expirada',
                    'body': 'La secuencia de '+ ncf_name_dic[sale_fiscal_type_compare]+' esta expirada, favor contactar con el encargado de contabilidad para actualizar la nueva fecha de expiración de la secuencia de '+ ncf_name_dic[sale_fiscal_type_compare] +' en la configuración del diario '+ self.pos.config.invoice_journal_id[1]
                });
                return;
            }

            else if (this.order_is_valid(force_validation)) {


                var next_ncf = '';
                if(current_order.is_return_order === false){
                    next_ncf = self.pos.db.get_next_ncf_sequence(partner.sale_fiscal_type);
                    current_order.origin_move_name = '';
                }else{
                    var return_order = self.pos.db.order_by_id[current_order.return_order_id];
                    current_order.origin_move_name = return_order.move_name;
                    next_ncf = self.pos.db.get_next_ncf_sequence('credit_note');
                }
                current_order.fiscal_type_name = next_ncf.fiscal_type_name
                current_order.move_name = next_ncf.sequence
                current_order.ncf_expiration_date = next_ncf.date_to;
                self.pos.set_order(current_order);


                this.finalize_validation();
            }
        },

    });

    screens.ClientListScreenWidget.include({

        show: function(){
            this._super();
            var self = this;
            this.$('.new-customer').click(function(){
            self.display_client_details('edit',{
                'sale_fiscal_type': 'consumo',
            });
        });
        },
        save_changes: function() {
            var self = this;
            var current_order = this.pos.get_order();
            this._super();
            if (this.has_client_changed()) {
                if (this.new_client && this.new_client.sale_fiscal_type === 'tributacion') {
                    var fiscal_position =  _.find(this.pos.fiscal_positions, function (fp) {
                            return fp.id === self.pos.config.special_fiscal_position_id[0];
                        })
                    if (fiscal_position) {
                        current_order.fiscal_position = fiscal_position;
                        current_order.trigger('change');
                        self.pos.set_order(current_order);
                    } else {
                        console.error('ERROR: La posición fiscal asignada para este tipo de cliente no esta configurada');
                    }
                }

            }



        }
    });
});
