import { Injectable, NgZone } from "@angular/core";
import { Http } from "@angular/http";
import { progress } from "@progress/jsdo-core";
import "rxjs/add/observable/fromPromise";
import "rxjs/add/observable/of";
import { Observable } from "rxjs/Observable";
import { Customer } from "./customer.model";

import { DataSource, DataSourceOptions } from "@progress/jsdo-nativescript";
import { JsdoSettings } from "../../shared/jsdo.settings";

/* ***********************************************************
* This is the master detail data service. It handles all the data operations
* of retrieving and updating the data. In this case, it is connected to a Progress Data Service and
*************************************************************/
@Injectable()
export class CustomerService {

    private jsdo: progress.data.JSDO;
    private dataSource: DataSource;
    private jsdoSettings: JsdoSettings = new JsdoSettings();

    constructor(private _ngZone: NgZone) {
        // console.log("DEBUG: In customer.service.ts: constructor()");
     }

    getCustomerById(id: string): Customer {
        if (!id) {
            return null;
        }

        return <Customer> this.dataSource.findById(id);
    }

    createDataSource(successFn, errorFn): void {
        if (!this.dataSource) {
            try {
                this.jsdo = new progress.data.JSDO({ name: JsdoSettings.resourceName });
                this.dataSource = new DataSource({
                    jsdo: this.jsdo,
                    tableRef: JsdoSettings.tableRef,
                    filter: JsdoSettings.filter,
                    sort: JsdoSettings.sort
                });

                successFn();
            } catch (e) {
                // console.log("DEBUG: " + e);
                errorFn();
                throw new Error("Error: " + e.message);
            }
        }
    }

    load(params?: progress.data.FilterOptions): Observable<any> {
        let promise;
        if (this.dataSource) {
            if (params) {
                promise = new Promise((resolve, reject) => {
                    this.dataSource.read(params).subscribe((myData: Array<Customer>) => {
                        resolve(myData);
                    }, (error) => {
                        reject(new Error("Error reading records: " + error.message));
                    });
                });

                return Observable.fromPromise(promise).catch(this.handleErrors);
            } else {
                return Observable.of(this.dataSource.getData());
            }
        } else {
            promise = new Promise((resolve, reject) => {
                this.createDataSource(() => {
                    this.dataSource.read(params).subscribe((myData: Array<Customer>) => {
                        resolve(myData);
                    }, (error) => {
                        reject(new Error("Error reading records: " + error.message));
                    });
                }, (error) => {
                    const message = (error && error.message) ? error.message : "Error reading records.";
                    reject(new Error(message));
                });
            });

            return Observable.fromPromise(promise).catch(this.handleErrors);
          }
    }

    createNewRecord(): Customer {
        return <Customer> this.dataSource.create({});
    }

    // Called for either existing record with changes or for created record.
    // For created record, createNewRecord() is first called 
    update(dataModel: Customer): Promise<any> {
        let ret = false;

        try {
            // First, let's update the underlying datasource memory
            ret = this.dataSource.update(dataModel);
            if (!ret) {
                throw new Error("Update: An error occurred updating underlying datasource.");
            }
        } catch (e) {
            Promise.reject(e);
        }

        return this.sync();
    }

    /**
     * Accepts any pending changes from the underlying data source
     */
    acceptChanges(): void {
        this.dataSource.acceptChanges();
    }

    /**
     * Cancels any pending changes from the underlying data source
     */
    cancelChanges(): void {
        this.dataSource.cancelChanges();
    }

    /**
     * Returns true if datasource provides edit capabilities, records can be created, updated and deleted.
     * If not, it returns false.
     */
    hasEditSupport(): boolean {
        return this.dataSource.hasCUDSupport() || this.dataSource.hasSubmitSupport();
    }
    sync(): Promise<any> {
        let promise;

        promise = new Promise(
            (resolve, reject) => {
                // Call dataSource.saveChanges() to send any pending changes to backend
                this.dataSource.saveChanges()
                    .then((result) => {
                        resolve(result);
                    }).catch((errors) => {
                        let errorMsg: string = "SaveChanges failed..";

                        if (errors) {
                            if (typeof errors === "string") {
                                errorMsg = errors;
                            } else if (Array.isArray(errors)) {
                                // This would occur when error info returned from jsdo.getErrors()
                                // For now, only one error message should be returned since app is processing
                                // single row changes
                                errors.forEach((err) => {
                                    errorMsg = err.error;
                                });
                            }
                        }

                        reject(new Error(errorMsg));
                    });
            }
        );

        return promise;
    }

    delete(customerModel): Promise<any> {
        // first make sure remove is successful
        try {
            const remove: boolean = this.dataSource.remove(customerModel);
        } catch (error) {
            Promise.reject(new Error ("Error calling remove: " + error));
        }

        return this.sync();
    }

    private handleErrors(error: Response): Observable<any> {
        return Observable.throw(error);
    }
}