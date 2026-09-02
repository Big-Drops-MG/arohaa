import { describe, expect, it } from 'vitest'
import { applyVehicleCatalogToLeads } from './vehicle-model-names.js'

describe('applyVehicleCatalogToLeads', () => {
  it('replaces make and model codes using year-specific catalog rows', () => {
    const leads = applyVehicleCatalogToLeads(
      [
        {
          fields: {
            car_0_year: '2027',
            car_0_make: 'BMW',
            car_0_model: '5221',
          },
        },
      ],
      [
        {
          year: 2027,
          makeCode: 'BMW',
          makeName: 'BMW',
          modelCode: '5221',
          modelName: '228',
        },
      ],
    )

    expect(leads[0]?.fields).toEqual({
      car_0_year: '2027',
      car_0_make: 'BMW',
      car_0_model: '228',
    })
  })

  it('resolves multiple vehicles and preserves unknown codes', () => {
    const leads = applyVehicleCatalogToLeads(
      [
        {
          fields: {
            car_0_year: '2020',
            car_0_make: 'BUI',
            car_0_model: '123',
            vehicle_1_year: '2021',
            vehicle_1_make: 'CHE',
            vehicle_1_model: 'unknown',
          },
        },
      ],
      [
        {
          year: 2020,
          makeCode: 'BUI',
          makeName: 'Buick',
          modelCode: '123',
          modelName: 'Enclave',
        },
      ],
    )

    expect(leads[0]?.fields).toMatchObject({
      car_0_make: 'Buick',
      car_0_model: 'Enclave',
      vehicle_1_make: 'CHE',
      vehicle_1_model: 'unknown',
    })
  })
})
